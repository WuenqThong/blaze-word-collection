"""Repeatable phase-2 acceptance: backend, guards, repeated runs and QA isolation."""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
from datetime import datetime, timezone

from run import REPOSITORY, ROOT, expected_ids, safe_root, save


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def execute():
    sys.stdout.reconfigure(encoding='utf-8')
    directory = Path(tempfile.mkdtemp(prefix='phase2-audit-', dir=safe_root()))
    summary = dict(status='RUNNING', evidence=str(directory), runs=[])
    protected = [Path('E:/blaze-voice-lab/qa/qa.db'),
                 Path(os.environ['LOCALAPPDATA']) / 'blaze-voice-qa' / 'qa.db']
    protected += list((REPOSITORY / 'backend').glob('*.db'))
    protected += [p.with_name(p.name + '-wal') for p in list(protected)]
    protected = [p for p in protected if p.exists()]
    initial = {str(p): sha(p) for p in protected}
    environment = dict(os.environ, DATABASE_URL='sqlite://', ENVIRONMENT='test', ENABLE_LEGACY='false',
                       JWT_SECRET='ephemeral-phase2-acceptance-test-only', PYTHONUTF8='1', PYTHONIOENCODING='utf-8')

    def command(name, arguments, cwd):
        print('Checking ' + name, flush=True)
        result = subprocess.run([sys.executable, *arguments], cwd=cwd, env=environment,
                                capture_output=True, encoding='utf-8', errors='replace', timeout=300)
        output = result.stdout + result.stderr
        (directory / (name + '.log')).write_text(output, encoding='utf-8')
        if result.returncode:
            raise RuntimeError(name + ' failed; inspect its log')
        return output

    try:
        backend = command('backend', ['-m', 'unittest', 'discover', '-s', 'tests', '-v'], REPOSITORY / 'backend')
        guards = command('guards', [str(Path(__file__).with_name('test_isolation.py'))], REPOSITORY)
        for name, output in (('backend', backend), ('guards', guards)):
            match = re.search(r'Ran (\d+) tests?', output)
            if not match or not re.search(r'\nOK\s*$', output):
                raise RuntimeError('Missing successful unittest summary: ' + name)
            summary[name + '_tests'] = int(match.group(1))
        reports = []
        for index, seed in enumerate((42, 42, 7)):
            prior = set(ROOT.glob('run-*'))
            command(f'simulator-{index}-seed{seed}', [str(Path(__file__).with_name('run.py')), '--seed', str(seed)], REPOSITORY)
            created = set(ROOT.glob('run-*')) - prior
            if len(created) != 1:
                raise RuntimeError('Cannot uniquely identify run; another simulator may be running')
            run_directory = created.pop()
            report = json.loads((run_directory / 'report.json').read_text(encoding='utf-8'))
            if report['status'] != 'PASSED' or report['passed'] != len(expected_ids()):
                raise RuntimeError('Simulator not fully passed')
            manifest = json.loads((run_directory / 'run.json').read_text(encoding='utf-8'))
            reports.append((report, manifest))
            summary['runs'].append(dict(seed=seed, directory=str(run_directory), passed=report['passed']))
        semantic = lambda report: [(r['id'], r['status'], r['steps'], r['error']) for r in report['scenarios']]
        if semantic(reports[0][0]) != semantic(reports[1][0]):
            raise RuntimeError('Same seed produced different expected/actual results')
        if len({manifest['source_sha256'] for _, manifest in reports}) != 1:
            raise RuntimeError('Source changed across acceptance runs')
        summary.update(status='PASSED', same_seed_reproducible=True, alternate_seed_passed=True,
                       source_sha256=reports[0][1]['source_sha256'], verified_at=datetime.now(timezone.utc).isoformat())
    except Exception as exc:
        summary.update(status='FAILED', error=f'{type(exc).__name__}: {exc}')
    finally:
        try:
            summary['protected_database_hashes_unchanged'] = {str(p): initial[str(p)] == sha(p) for p in protected}
            if not all(summary['protected_database_hashes_unchanged'].values()):
                summary.update(status='FAILED', error='Protected database changed during audit; investigate concurrent activity')
        except OSError as exc:
            summary.update(status='FAILED', error='Cannot verify protected database: ' + str(exc))
        save(directory / 'acceptance.json', summary)
        print(json.dumps(summary, ensure_ascii=False, indent=2), flush=True)
    return 0 if summary['status'] == 'PASSED' else 1


if __name__ == '__main__':
    sys.exit(execute())
