"""Run real ASGI API scenarios in a fresh, retained simulator database.

Parent uses stdlib only. App imports happen solely in a subprocess after the
database/environment have been isolated. No live server, cleanup or GPU needed.
"""
import argparse
from collections import Counter
from contextlib import ExitStack
from datetime import datetime, timezone
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import random
import secrets
import subprocess
import sys
import tempfile
import time
import traceback
import zipfile

REPOSITORY = Path(__file__).resolve().parents[2]
ROOT = Path('E:/blaze-voice-lab/simulator')
FIXTURES = Path(__file__).with_name('fixtures.json')
CONSENT = dict(collect=True, train=True, public=False, audio=False, version='demo-consent-v1')
VOTE = dict(verdict='VERIFIED', meaning_ok=True, region_ok=True, context_ok=True,
            translation_ok=True, note='Synthetic simulator independent review')
LABELS = {
    'valid': 'Mẫu đủ điều kiện → duyệt → chuẩn hóa → release',
    'one_vote': 'Thiếu phiếu độc lập và chặn bỏ phiếu lặp',
    'self_review': 'Chặn tự duyệt và tự chuẩn hóa',
    'no_train_consent': 'Chặn đóng góp mới không có consent train',
    'no_source_rights': 'Chặn xuất khi thiếu quyền nguồn',
    'disagreement': 'Bất đồng → admin phân xử → xuất hoặc chặn theo quyết định',
    'retry': 'Mất phản hồi rồi gửi lại không tạo mẫu trùng',
    'revoke_consent': 'Thu hẹp consent chặn tải release cũ',
    'withdraw': 'Rút mẫu chặn tải release và khôi phục ngầm',
    'incomplete_curated': 'Thiếu CURATED đầy đủ không được xuất',
    'connected_group': 'Gom người góp/nguồn/biến thể cùng split',
    'quality_hold': 'Dữ liệu nghi vấn vào HOLD, giữ RAW',
}


def save(path, value):
    temporary = path.with_name(path.name + '.tmp')
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')
    os.replace(temporary, path)


def expected_ids():
    return ([f's{i:02d}' for i in range(1, 31)] + ['independent_groups'] +
            ['relation_' + name for name in ('source', 'variant', 'family', 'sense')] +
            ['split_audit', 'adjudication_guards', 'release_invalidation', 'concurrent_requests',
             'training_error', 'cuda_oom'])


def render_report(directory, report):
    lines = ['# Báo cáo simulator', '', f"Run: `{directory.name}` · Seed: {report.get('seed')}", '',
             f"Trạng thái: **{report['status']}** · PASS: {report['passed']} · FAIL: {report['failed']}", '',
             '**DỮ LIỆU GIẢ — chỉ kiểm phần mềm, không dùng train hoặc công bố chất lượng model.**', '',
             '| ID | Kịch bản | Chế độ | Kết quả |', '| --- | --- | --- | --- |']
    lines.extend(f"| {r['id']} | {r['label']} | {r['mode']} | {r['status']} |" for r in report['scenarios'])
    lines += ['', 'Expected/actual: `report.json`. Log: `worker.log`.', '', '## Giới hạn', '']
    lines += ['- ' + item for item in report.get('limitations', [])]
    if report.get('fatal'):
        lines += ['', 'Lỗi khởi tạo/kết thúc: ' + report['fatal']]
    (directory / 'report.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')


def finish_report(directory, exit_code, failure=None):
    """Fail closed for crashes, corrupt/missing reports and missing scenarios."""
    try:
        report = json.loads((directory / 'report.json').read_text(encoding='utf-8'))
        rows = report['scenarios']
        if not isinstance(rows, list):
            raise ValueError('invalid scenarios')
        if any(not isinstance(row, dict) or not {'id', 'label', 'mode', 'status', 'steps'} <= row.keys()
               or not isinstance(row['steps'], list)
               or any(not isinstance(step, dict) for step in row['steps']) for row in rows):
            raise ValueError('invalid scenario schema')
        actual = [row['id'] for row in rows]
        valid_rows = all(row.get('status') == 'PASS' and row.get('steps') and
                         all(step.get('passed') is True for step in row['steps']) for row in rows)
        success = (exit_code == 0 and not failure and report.get('complete') is True and
                   report.get('status') == 'PASSED' and actual == expected_ids() and valid_rows)
        report['passed'] = sum(row.get('status') == 'PASS' for row in rows)
        report['failed'] = sum(row.get('status') != 'PASS' for row in rows)
    except (OSError, ValueError, KeyError, TypeError, AttributeError):
        success = False
        report = dict(synthetic=True, scenarios=[], passed=0, failed=0)
        failure = failure or 'Worker report missing or malformed; inspect worker.log'
    report.update(status='PASSED' if success else 'FAILED', complete=True,
                  fatal=None if success else (failure or report.get('fatal') or
                        f'Worker incomplete, invalid scenario coverage or exit code {exit_code}'))
    save(directory / 'report.json', report)
    render_report(directory, report)
    return report, 0 if success else 1


def verify_sources(directory):
    manifest = json.loads((directory / 'run.json').read_text(encoding='utf-8'))
    for relative, expected in manifest['source_hashes'].items():
        path = (REPOSITORY / relative).resolve()
        if REPOSITORY not in path.parents or digest(path.read_bytes()) != expected:
            raise RuntimeError('Source changed during run: ' + relative)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def safe_root():
    # Refuse redirected/junction paths, repository children, and alternate roots.
    if os.path.normcase(os.path.realpath(ROOT)) != os.path.normcase(os.path.abspath(ROOT)):
        raise RuntimeError('Refusing redirected simulator root')
    if ROOT.resolve() == REPOSITORY or REPOSITORY in ROOT.resolve().parents:
        raise RuntimeError('Simulator must be outside repository')
    return ROOT


def validate_run(directory, seed):
    directory = directory.resolve()
    if directory.parent != safe_root().resolve():
        raise RuntimeError('Run directory must be an immediate child of simulator root')
    marker = json.loads((directory / 'run.json').read_text(encoding='utf-8'))
    if marker.get('run_id') != directory.name or marker.get('seed') != seed or marker.get('synthetic') is not True:
        raise RuntimeError('Invalid simulator run marker')
    if os.path.lexists(directory / 'simulator.db'):
        raise RuntimeError('Refusing to reuse an existing simulator database')
    expected = 'sqlite:///' + (directory / 'simulator.db').as_posix()
    if os.environ.get('DATABASE_URL') != expected or os.environ.get('ENVIRONMENT') != 'test':
        raise RuntimeError('Worker database/environment isolation mismatch')
    if 'app.main' in sys.modules or 'app.core.database' in sys.modules:
        raise RuntimeError('Application imported before isolation checks')
    return directory


class Runner:
    def __init__(self, directory, seed):
        self.directory, self.seed = directory, seed
        self.results, self.steps, self.items = [], [], {}
        self.fixture_path = directory / 'fixtures.json'
        content = self.fixture_path.read_bytes()
        marker = json.loads((directory / 'run.json').read_text(encoding='utf-8'))
        if digest(content) != marker['fixture_sha256']:
            raise RuntimeError('Fixture copy checksum mismatch')
        self.fixture = json.loads(content)
        if self.fixture.get('synthetic') is not True or len(self.fixture['samples']) != 30:
            raise RuntimeError('Expected 30 synthetic fixtures')
        if len({s['id'] for s in self.fixture['samples']}) != 30:
            raise RuntimeError('Fixture IDs must be unique')
        extra_path = directory / 'extended_fixtures.json'
        if digest(extra_path.read_bytes()) != marker['extended_fixture_sha256']:
            raise RuntimeError('Extended fixture checksum mismatch')

    def check(self, condition, expected, actual):
        self.steps.append(dict(type='assertion', expected=expected, actual=actual, passed=bool(condition)))
        if not condition:
            raise AssertionError(f'Expected {expected}; actual {actual}')

    def request(self, who, method, path, expected=200, **kwargs):
        response = self.clients[who].request(method, '/api/dialect' + path, **kwargs)
        step = dict(type='api', actor=who, method=method, path=path,
                    expected=expected, actual=response.status_code, passed=response.status_code == expected)
        self.steps.append(step)
        if not step['passed']:
            raise AssertionError(f'{method} {path}: expected {expected}, got {response.status_code}: {response.text[:1500]}')
        return response.json() if response.content else None

    def body(self, sample):
        source = sample.get('source_group', sample['id'])
        return dict(kind='sentence', original_text=sample['text'], meaning=sample['standard'],
                    standard_vi=sample['standard'], region='Hội An',
                    context=f"Tình huống tổng hợp {sample['id']}: hỏi đáp hằng ngày, chưa được chuyên gia xác minh.",
                    source_evidence=f'SYNTHETIC SOFTWARE FIXTURE: {source}; NOT FOR TRAINING',
                    variants=sample.get('variants', ''),
                    consent_collect=True, consent_train=sample['case'] != 'no_train_consent',
                    consent_public=False, consent_audio=False, consent_version='demo-consent-v1',
                    method='direct', idempotency_key=f"sim-{self.seed}-{sample['id']}")

    def votes(self, item, actors=('reviewer-a', 'reviewer-b')):
        for actor in actors:
            item = self.request(actor, 'POST', f"/reviews/{item['id']}/votes", json=VOTE)
        return item

    def rights(self, item):
        self.request('admin', 'POST', f"/sources/{item['source_id']}/rights",
                     json=dict(rights_confirmed=True, public=False, audio=False, note='Synthetic fixture source only'))

    def curate(self, item, sample, incomplete=False):
        raw = dict(text=sample['text'], meaning=sample['standard'], standard=sample['standard'],
                   context='' if incomplete else item['raw']['context'], region='Hội An',
                   variants=sample.get('variants', ''))
        result = self.request('admin', 'POST', f"/reviews/{item['id']}/curate", json=dict(raw=raw))
        self.check(result['raw'] == item['raw'], 'RAW unchanged after CURATED', result['raw'] == item['raw'])

    def release(self, ids, expected=201):
        return self.request('admin', 'POST', '/releases', expected,
                            json=dict(ids=ids, splits={str(cid): 'test' for cid in ids},
                                      data_card='Client cannot grant permission or benchmark status'))

    def run_case(self, sample):
        case = sample['case']
        owner = 'reviewer-a' if case == 'self_review' else ('contributor-a' if int(sample['id'][1:]) % 2 else 'contributor-b')
        body = self.body(sample)
        if case == 'no_train_consent':
            self.request(owner, 'POST', '/contributions', 422, json=body)
            from app.models.dialect import DialectContribution
            from app.core.database import SessionLocal
            with SessionLocal() as db:
                count = db.query(DialectContribution).filter_by(idempotency_key=body['idempotency_key']).count()
            self.check(count == 0, 'rejected input creates no row', count)
            return
        item = self.request(owner, 'POST', '/contributions', 201, json=body)
        cid = item['id']
        self.items[sample['id']] = cid
        if case == 'quality_hold':
            self.check(item['status'] == 'HOLD', 'HOLD', item['status'])
            self.check(sample['reason'] in item['quality_reasons'], sample['reason'], item['quality_reasons'])
            self.check(item['raw']['original_text'] == sample['text'], 'RAW preserved', item['raw']['original_text'])
            self.request('reviewer-a', 'POST', f'/reviews/{cid}/votes', 409, json=VOTE)
            self.release([cid], 409)
            return
        self.check(item['status'] == 'RAW', 'RAW', item['status'])
        if case == 'retry':
            # Response was delivered by server, discarded by client: retry same request.
            again = self.request(owner, 'POST', '/contributions', 201, json=body)
            self.check(cid == again['id'], 'same ID on retry after lost response', again['id'])
            self.request(owner, 'POST', '/contributions', 409, json={**body, 'original_text': 'Nội dung khác'})
            from app.core.database import SessionLocal
            from app.models.dialect import DialectContribution
            with SessionLocal() as db:
                count = db.query(DialectContribution).filter_by(idempotency_key=body['idempotency_key']).count()
            self.check(count == 1, 'exactly one persisted contribution', count)
            other = 'contributor-b' if owner == 'contributor-a' else 'contributor-a'
            self.request(other, 'POST', f'/contributions/{cid}/consent', 403, json=dict(consent=CONSENT))
            return
        if case == 'self_review':
            self.request(owner, 'POST', f'/reviews/{cid}/votes', 403, json=VOTE)
            item = self.votes(item, ('reviewer-b', 'admin'))
            self.request(owner, 'POST', f'/reviews/{cid}/curate', 403, json=dict(raw=dict(
                text=sample['text'], meaning=sample['standard'], standard=sample['standard'], context='Synthetic')))
            return
        if case == 'one_vote':
            once = self.request('reviewer-a', 'POST', f'/reviews/{cid}/votes', json=VOTE)
            self.check(once['status'] == 'REVIEW', 'REVIEW after one vote', once['status'])
            self.request('reviewer-a', 'POST', f'/reviews/{cid}/votes', 409, json=VOTE)
            self.release([cid], 409)
            return
        if case == 'disagreement':
            self.request('reviewer-a', 'POST', f'/reviews/{cid}/votes', json=VOTE)
            disputed = self.request('reviewer-b', 'POST', f'/reviews/{cid}/votes',
                                    json={**VOTE, 'verdict': 'REJECT', 'translation_ok': False})
            self.check(disputed['status'] == 'REVIEW', 'REVIEW pending adjudication', disputed['status'])
            self.release([cid], 409)
            decision = dict(verdict='VERIFIED' if sample['id'] == 's16' else 'REJECT',
                            note='Synthetic independent adjudication: ' + sample['id'])
            self.request(owner, 'POST', f'/reviews/{cid}/finalize', 403, json=decision)
            self.request('reviewer-a', 'POST', f'/reviews/{cid}/finalize', 403, json=decision)
            self.request('admin', 'POST', f'/reviews/{cid}/curate', 409, json=dict(raw={}))
            self.request('admin', 'POST', f'/reviews/{cid}/finalize', 422, json={**decision, 'note': ''})
            self.request('admin', 'POST', f'/reviews/{cid}/finalize', 422, json={**decision, 'note': ' \t\n '})
            resolved = self.request('admin', 'POST', f'/reviews/{cid}/finalize', json=decision)
            self.check(resolved['status'] == decision['verdict'], decision['verdict'], resolved['status'])
            self.check(resolved['vote_count'] == 2, 'two original votes retained', resolved['vote_count'])
            self.check(any(e['action'] == decision['verdict'] and e['note'] == decision['note'] for e in resolved['events']),
                       'adjudication reason recorded', [e['action'] for e in resolved['events']])
            self.request('admin', 'POST', f'/reviews/{cid}/finalize', 409, json=decision)
            if decision['verdict'] == 'VERIFIED':
                self.release([cid], 409)  # Still requires source rights and CURATED.
                self.rights(resolved)
                self.curate(resolved, sample)
                release = self.release([cid])
                exported = self.request('admin', 'GET', f"/releases/{release['id']}")
                self.check([row['id'] for row in exported['records']] == [cid],
                           'only adjudicated approved sample exported', [row['id'] for row in exported['records']])
                self.check(exported['records'][0]['raw'] == item['raw'], 'adjudication preserves original RAW',
                           exported['records'][0]['raw'] == item['raw'])
            else:
                self.rights(resolved)
                self.request('admin', 'POST', f'/reviews/{cid}/curate', 409, json=dict(raw={}))
                self.release([cid], 409)
            return
        item = self.votes(item)
        self.check(item['status'] == 'VERIFIED', 'VERIFIED after two independent votes', item['status'])
        if case == 'no_source_rights':
            self.curate(item, sample)
            self.request(owner, 'POST', f"/sources/{item['source_id']}/rights", 403,
                         json=dict(rights_confirmed=True, note='Attempt from contributor'))
            self.release([cid], 409)
            return
        self.rights(item)
        self.curate(item, sample, incomplete=case == 'incomplete_curated')
        if case == 'incomplete_curated':
            self.release([cid], 409)
            return
        preview = self.request('admin', 'GET', '/releases/preview')
        self.check(preview['eligible_count'] >= 1, 'at least one eligible sample', preview['eligible_count'])
        created = self.release([cid])
        download = self.request('admin', 'GET', f"/releases/{created['id']}")
        self.check([r['id'] for r in download['records']] == [cid], 'exact selected IDs exported', [r['id'] for r in download['records']])
        self.check(bool(download['records'][0]['curated']), 'CURATED present', bool(download['records'][0]['curated']))
        card = json.loads(download['manifest']['data_card'])
        self.check(card['benchmark'] is False, 'not a benchmark', card['benchmark'])
        if case == 'revoke_consent':
            self.request(owner, 'POST', f'/contributions/{cid}/consent', json=dict(consent={**CONSENT, 'train': False}))
            self.request('admin', 'GET', f"/releases/{created['id']}", 409)
            self.release([cid], 409)
        elif case == 'withdraw':
            self.request(owner, 'POST', f'/contributions/{cid}/consent', json=dict(consent=CONSENT, withdraw=True))
            self.request('admin', 'GET', f"/releases/{created['id']}", 409)
            self.request(owner, 'POST', f'/contributions/{cid}/consent', 409, json=dict(consent=CONSENT))
        elif case == 'connected_group' and sample['id'] == 's26':
            ids = [self.items['s25'], cid]
            pair = self.release(ids)
            exported = self.request('admin', 'GET', f"/releases/{pair['id']}")
            provenance = json.loads(exported['manifest']['data_card'])['provenance']
            self.check(len({p['group'] for p in provenance}) == 1, 'shared source/variant → one connected group', [p['group'] for p in provenance])
            self.check(len({r['split'] for r in exported['records']}) == 1, 'one group never spans splits', [r['split'] for r in exported['records']])
            self.check(all(r['split'] == 'train' for r in exported['records']), 'fewer than three contributor groups → train only', [r['split'] for r in exported['records']])
            self.check(bool(exported['manifest']['warnings']), 'insufficient independent groups warning', exported['manifest']['warnings'])

    def scenario(self, sid, label, mode, operation):
        self.steps = []
        start = time.monotonic()
        error = None
        try:
            operation()
        except Exception as exc:
            error = f'{type(exc).__name__}: {exc}'
            (self.directory / f'{sid}-error.txt').write_text(traceback.format_exc(), encoding='utf-8')
        row = dict(id=sid, label=label, mode=mode, status='FAIL' if error else 'PASS',
                   duration_seconds=round(time.monotonic() - start, 3), steps=self.steps, error=error)
        self.results.append(row)
        print(f"{row['status']} {sid}: {label}", flush=True)
        self.write_report()

    def mock_job(self, name):
        # Explicit fault injection. Does not exercise a backend training worker.
        path = self.directory / 'mock-jobs' / name
        path.mkdir(parents=True, exist_ok=False)
        job = dict(mode='mock', synthetic=True, status='queued', history=['queued'], model_path=None)
        job['status'] = 'running'
        job['history'].append('running')
        try:
            if name == 'cuda_oom':
                raise MemoryError('SIMULATED CUDA out of memory; no GPU allocated')
            raise RuntimeError('SIMULATED training worker failure; no trainer started')
        except (MemoryError, RuntimeError) as exc:
            job.update(status='failed', error_type=type(exc).__name__, error=str(exc))
            job['history'].append('failed')
        save(path / 'job.json', job)
        self.check(job['status'] == 'failed', 'failed, never succeeded', job['status'])
        self.check(job['model_path'] is None and not (path / 'model').exists(), 'no model artifact after failure', job['model_path'])
        self.check(bool(job.get('error')), 'error persisted', job.get('error'))

    def write_report(self, complete=False, fatal=None):
        counts = Counter(r['status'] for r in self.results)
        report = dict(run_id=self.directory.name, seed=self.seed, synthetic=True,
                      status='FAILED' if fatal or counts['FAIL'] else ('PASSED' if complete else 'RUNNING'),
                      complete=complete, fatal=fatal, fixture_sha256=digest(self.fixture_path.read_bytes()),
                      database=str(self.directory / 'simulator.db'), transport='in-process ASGI TestClient; real auth cookies and SQLAlchemy; no dependency overrides',
                      fixture_count=68, base_fixture_count=30, extended_fixture_count=32, audit_fixture_count=6,
                      persisted_contribution_ids=self.items,
                      passed=counts['PASS'], failed=counts['FAIL'], scenarios=self.results,
                      limitations=['Synthetic language labels, not expert gold.',
                                   'Retry simulates a lost response, not a real network outage.',
                                   'Job errors are mock fault injection, not a production training worker test.',
                                   'Base fixtures test train-only; extended fixtures test independent synthetic groups, never an expert benchmark.',
                                   'No browser UI, real model training, audio or GPU exhaustion tested.'])
        save(self.directory / 'report.json', report)
        render_report(self.directory, report)

    def execute(self):
        from fastapi.testclient import TestClient
        from app.main import app
        from app.core.database import SessionLocal, engine
        from app.models.user import User
        self.check(not app.dependency_overrides, 'real app dependencies', list(app.dependency_overrides))
        credentials = []
        names = ('contributor-a', 'contributor-b', 'reviewer-a', 'reviewer-b', 'admin')
        with ExitStack() as stack:
            self.clients = {name: stack.enter_context(TestClient(app)) for name in names}
            for name, client in self.clients.items():
                account = dict(email=f'{name}@simulator.example.com', password=secrets.token_urlsafe(24), full_name='SIMULATOR ' + name)
                response = client.post('/api/auth/register', json=account)
                if response.status_code != 201:
                    raise RuntimeError(f'Cannot create synthetic account {name}: HTTP {response.status_code}')
                account['id'] = response.json()['user']['id']
                credentials.append(account)
            save(self.directory / 'accounts.json', credentials)
            # Only bootstrap admin requires a direct DB write, on this fresh DB.
            with SessionLocal() as db:
                db.get(User, credentials[-1]['id']).role = 'admin'
                db.commit()
            for account in credentials:
                if account['email'].startswith('reviewer-'):
                    self.request('admin', 'PUT', f"/participants/{account['id']}",
                                 json=dict(role='reviewer', review_region='Hội An'))
            for sample in self.fixture['samples']:
                self.scenario(sample['id'], LABELS[sample['case']], 'real-api', lambda s=sample: self.run_case(s))
            from extended_scenarios import ExtendedScenarios
            ExtendedScenarios(self, stack).execute()
            from final_scenarios import FinalScenarios
            FinalScenarios(self).execute()
            for name in ('training_error', 'cuda_oom'):
                self.scenario(name, 'Giả lập lỗi job: ' + name, 'mock-fault', lambda n=name: self.mock_job(n))
        engine.dispose()
        self.write_report(complete=True)
        return 1 if any(r['status'] == 'FAIL' for r in self.results) else 0


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--seed', type=int, default=42)
    parser.add_argument('--worker', type=Path, help=argparse.SUPPRESS)
    args = parser.parse_args()
    if not 0 <= args.seed <= 2147483647:
        parser.error('Seed must be between 0 and 2147483647')
    random.seed(args.seed)
    if args.worker:
        directory = validate_run(args.worker, args.seed)
        verify_sources(directory)
        runner = Runner(directory, args.seed)
        runner.write_report()
        try:
            return runner.execute()
        except Exception as exc:
            runner.write_report(complete=True, fatal=f'{type(exc).__name__}: {exc}')
            raise
    root = safe_root()
    root.mkdir(parents=True, exist_ok=True)
    directory = Path(tempfile.mkdtemp(prefix=f"run-{datetime.now(timezone.utc):%Y%m%dT%H%M%SZ}-seed{args.seed}-", dir=root))
    source_files = sorted((REPOSITORY / 'backend' / 'app').rglob('*.py'))
    source_files += [Path(__file__).resolve(), FIXTURES]
    source_files += [Path(__file__).with_name('extended_scenarios.py'), Path(__file__).with_name('extended_fixtures.json')]
    source_files += [Path(__file__).with_name('final_scenarios.py')]
    source_files += list((REPOSITORY / 'backend' / 'app' / 'data').rglob('*.json'))
    source_files += [Path(__file__).with_name('test_isolation.py'), REPOSITORY / 'backend' / 'requirements.txt',
                     REPOSITORY / 'scripts' / 'run-simulator.ps1', Path(__file__).with_name('verify_phase.py'),
                     REPOSITORY / 'scripts' / 'verify-phase2.ps1']
    source_hashes = {str(p.relative_to(REPOSITORY)): digest(p.read_bytes()) for p in source_files}
    save(directory / 'run.json', dict(run_id=directory.name, seed=args.seed, synthetic=True,
                                   fixture_sha256=digest(FIXTURES.read_bytes()),
                                   extended_fixture_sha256=digest(Path(__file__).with_name('extended_fixtures.json').read_bytes()),
                                   source_sha256=digest(json.dumps(source_hashes, sort_keys=True).encode()),
                                   source_hashes=source_hashes, python=sys.version,
                                   packages={d.metadata['Name']: d.version for d in importlib.metadata.distributions() if d.metadata['Name']}))
    (directory / 'fixtures.json').write_bytes(FIXTURES.read_bytes())
    (directory / 'extended_fixtures.json').write_bytes(Path(__file__).with_name('extended_fixtures.json').read_bytes())
    with zipfile.ZipFile(directory / 'source-snapshot.zip', 'w', compression=zipfile.ZIP_DEFLATED) as archive:
        for relative in source_hashes:
            archive.write(REPOSITORY / relative, relative)
    env = dict(os.environ, DATABASE_URL='sqlite:///' + (directory / 'simulator.db').as_posix(),
               ENVIRONMENT='test', DEBUG='false', ENABLE_LEGACY='false', COOKIE_SECURE='false',
               COOKIE_SAMESITE='lax', COOKIE_NAME='blaze_simulator', JWT_SECRET=secrets.token_urlsafe(48),
               RATE_LIMIT_ENABLED='true', RATE_LIMIT_AUTH='1000', RATE_LIMIT_CONTRIBUTIONS='1000',
               PYTHONPATH=str(REPOSITORY / 'backend'), PYTHONIOENCODING='utf-8', PYTHONUTF8='1',
               MINIO_BUCKET='blaze-simulator-unused')
    print(f'Fresh simulator run: {directory}', flush=True)
    failure = None
    with (directory / 'worker.log').open('w', encoding='utf-8') as log:
        try:
            result = subprocess.run([sys.executable, str(Path(__file__).resolve()), '--seed', str(args.seed), '--worker', str(directory)],
                                    env=env, cwd=REPOSITORY / 'backend', stdout=log, stderr=subprocess.STDOUT, timeout=240)
            code = result.returncode
        except subprocess.TimeoutExpired:
            code = 1
            failure = 'Worker timeout after 240 seconds'
            save(directory / 'launcher-error.json', dict(status='FAILED', error='worker timeout after 240 seconds'))
    try:
        verify_sources(directory)
    except (OSError, RuntimeError, ValueError) as exc:
        failure = str(exc)
    report_path = directory / 'report.json'
    report, code = finish_report(directory, code, failure)
    for row in report['scenarios']:
        print(f"{row['status']} {row['id']}: {row['label']}")
    print(f"Status: {report['status']}; PASS={report['passed']}; FAIL={report['failed']}")
    print(f'Report: {directory / "report.md"}\nDetails: {report_path}\nLog: {directory / "worker.log"}')
    return code


if __name__ == '__main__':
    sys.exit(main())
