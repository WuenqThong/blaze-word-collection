import copy
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import httpx
from app.services.blaze_translation import BlazeTranslation, TranslationCallError, run_experiment
from app.services.dataset_package import checksum
from app.services.translation_evaluation import CASES_SCHEMA, DIRECTION, evaluate, prepare, request_for, validate_cases


def cases():
    train = [{'id': 'train-1', 'group': 'train-group', 'source': 'mô', 'target': 'đâu', 'region': 'Hội An', 'kind': 'word'}]
    return {'schema': CASES_SCHEMA, 'direction': DIRECTION,
            'dataset': {'origin': 'synthetic', 'version': 'synthetic-fixture', 'package_sha256': checksum('fixture'), 'rights_check': 'synthetic_no_user_data'},
            'required_regions': ['Hội An', 'Hải Châu'], 'required_kinds': ['word', 'sentence'],
            'adaptation': train, 'adaptation_sha256': checksum(train), 'cases': [
                {'id': 'test-1', 'group': 'test-group', 'source': 'Mi đi mô?', 'references': ['Bạn đi đâu?'], 'region': 'Hội An', 'kind': 'sentence', 'reference_review': {'status': 'pending'}},
                {'id': 'test-2', 'group': 'other-test', 'source': 'rứa', 'references': ['thế'], 'region': 'Hội An', 'kind': 'word', 'reference_review': {'status': 'pending'}},
            ]}


class TranslationTests(unittest.TestCase):
    def test_verified_release_preparation_uses_only_test_and_train_partitions(self):
        from test_dataset_release import DatasetReleaseTest
        from app.core.database import utcnow
        from app.services.dataset_package import make_package
        from app.services.dataset_release import build_release
        fixture = DatasetReleaseTest()
        fixture.setUp()
        try:
            for _ in range(12):
                fixture.add(kind='word', region='Hội An')
            plan = build_release(fixture.db, fixture.items)
            package = make_package(1, utcnow(), plan['records'], plan['data_card'])
            document = prepare(package)
            validate_cases(document)
            split = {str(r['id']): r['split'] for r in plan['records']}
            self.assertTrue(all(split[c['id']] == 'test' for c in document['cases']))
            self.assertTrue(all(split[c['id']] == 'train' for c in document['adaptation']))
            self.assertTrue(all(c['reference_review']['status'] == 'pending' for c in document['cases']))
            selected = [r['id'] for r in plan['records'] if r['split'] == 'train']
            train_plan = build_release(fixture.db, fixture.items, selected)
            with self.assertRaisesRegex(ValueError, 'tập kiểm tra'):
                prepare(make_package(2, utcnow(), train_plan['records'], train_plan['data_card']))
        finally:
            fixture.tearDown()

    def test_outbound_request_never_contains_test_references_and_matches_same_region_only(self):
        document = cases()
        baseline, n = request_for(document['cases'][0], document['adaptation'], False)
        self.assertEqual(n, 0)
        augmented, n = request_for(document['cases'][0], document['adaptation'], True)
        self.assertEqual(n, 1)
        self.assertNotIn(document['cases'][0]['references'][0], json.dumps(augmented, ensure_ascii=False))
        self.assertEqual(set(augmented), {'input', 'source_language', 'target_language', 'format', 'stream', 'instructions'})
        self.assertEqual(baseline['input'], augmented['input'])
        wrong_region = {**document['cases'][0], 'region': 'Hải Châu'}
        self.assertEqual(request_for(wrong_region, document['adaptation'], True)[1], 0)
        self.assertEqual(request_for({**document['cases'][0], 'source': 'môm'}, document['adaptation'], True)[1], 0)

    def test_real_adapter_contract_and_paired_report_keep_failures_and_show_gaps(self):
        calls = []
        def handler(request):
            payload = json.loads(request.content)
            calls.append(payload)
            self.assertEqual(str(request.url), 'https://api.blaze.vn/v1/translations')
            self.assertEqual(request.headers['authorization'], 'Bearer private-test-token')
            if payload['input'] == 'rứa':
                if len(calls) > 2:
                    return httpx.Response(429, json={'detail': 'private-test-token'})
                output = 'thế'
            else:
                output = 'Bạn đi đâu?' if 'Từ điển tham khảo' in payload['instructions'] else 'Bạn đang đi.'
            return httpx.Response(200, json={'model': 'blaze-translate-1', 'output_text': output})
        document = cases()
        with BlazeTranslation('private-test-token', transport=httpx.MockTransport(handler)) as client:
            before = run_experiment(document, client)
            after = run_experiment(document, client, True)
        report = evaluate(document, before, after)
        self.assertEqual(len(calls), 4)  # No hidden retries/billing calls.
        self.assertEqual(report['status'], 'synthetic_smoke')
        self.assertEqual(report['overall']['count'], 2)
        self.assertEqual(report['overall']['improved'], 1)
        self.assertEqual(report['overall']['regressed'], 1)
        self.assertEqual(report['overall']['after']['api_errors'], 1)
        self.assertEqual(report['overall']['after']['exact_match_rate'], .5)
        self.assertEqual(report['pending_reference_reviews'], 2)
        self.assertEqual(len(report['coverage_gaps']), 2)
        self.assertTrue(all(g['region'] == 'Hải Châu' for g in report['coverage_gaps']))
        self.assertNotIn('private-test-token', json.dumps([before, after, report]))
        for mutation in ('missing', 'duplicate', 'version', 'requests', 'cases_digest'):
            bad = copy.deepcopy(after)
            if mutation == 'missing': bad['items'].pop()
            elif mutation == 'duplicate': bad['items'][1] = bad['items'][0]
            elif mutation == 'version': bad['system_version'] = 'other-model'
            elif mutation == 'requests': bad['items'][0]['request_sha256'] = 'bad'
            else: bad['cases_sha256'] = 'bad'
            with self.subTest(mutation=mutation), self.assertRaises(ValueError):
                evaluate(document, before, bad)

    def test_unsafe_or_incomplete_reference_and_training_overlap_rejected(self):
        for mutation in ('group', 'id', 'reference', 'approval', 'direction'):
            document = cases()
            if mutation == 'group': document['cases'][0]['group'] = 'train-group'
            elif mutation == 'id': document['cases'][0]['id'] = 'train-1'
            elif mutation == 'reference': document['cases'][0]['references'] = [' ']
            elif mutation == 'approval': document['cases'][0]['reference_review'] = {'status': 'approved'}
            else: document['direction'] = 'standard_to_dialect'
            with self.subTest(mutation=mutation), self.assertRaises(ValueError):
                validate_cases(document)

    def test_auth_redirect_timeout_and_response_validation_never_expose_secret(self):
        for response, code in [(httpx.Response(302, headers={'location': 'https://other.example'}), 'request_rejected'),
                               (httpx.Response(200, json={'model': 'changed', 'output_text': 'text'}), 'model_changed'),
                               (httpx.Response(200, json={'model': 'blaze-translate-1', 'output_text': ''}), 'invalid_response'),
                               (httpx.Response(500, text='private-test-token'), 'server_error')]:
            with self.subTest(code=code), BlazeTranslation('private-test-token', transport=httpx.MockTransport(lambda _: response)) as client:
                with self.assertRaises(TranslationCallError) as caught:
                    client.translate(request_for(cases()['cases'][0], [], False)[0])
                self.assertEqual(caught.exception.code, code)
                self.assertNotIn('private-test-token', str(caught.exception))
        with BlazeTranslation('private-test-token', transport=httpx.MockTransport(lambda _: httpx.Response(401, text='private-test-token'))) as client:
            with self.assertRaisesRegex(ValueError, 'authentication_failed'):
                run_experiment(cases(), client)
        def timeout(request):
            raise httpx.ReadTimeout('private-test-token', request=request)
        with BlazeTranslation('private-test-token', transport=httpx.MockTransport(timeout)) as client:
            result = run_experiment(cases(), client)
            self.assertTrue(all(r['error_code'] == 'timeout' for r in result['items']))
            self.assertNotIn('private-test-token', json.dumps(result))

    def test_secret_excluded_and_comparison_cli_works_without_token_or_database(self):
        from app.core.config import Settings
        self.assertNotIn('blaze_api_token', Settings(blaze_api_token='private-test-token').model_dump())
        document = cases()
        transport = httpx.MockTransport(lambda _: httpx.Response(200, json={'model': 'blaze-translate-1', 'output_text': 'thế'}))
        with BlazeTranslation('private-test-token', transport=transport) as client:
            baseline, candidate = run_experiment(document, client), run_experiment(document, client, True)
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for name, data in [('cases', document), ('before', baseline), ('after', candidate)]:
                (root / (name + '.json')).write_text(json.dumps(data), encoding='utf-8')
            args = [sys.executable, '-m', 'scripts.evaluate_translation', 'compare', '--cases', str(root/'cases.json'), '--baseline', str(root/'before.json'), '--candidate', str(root/'after.json'), '--output', str(root/'result.json')]
            env = {**os.environ, 'DATABASE_URL': 'not-allowed://', 'BLAZE_API_TOKEN': ''}
            result = subprocess.run(args, cwd=Path(__file__).resolve().parents[1], env=env, capture_output=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(json.loads((root/'result.json').read_text(encoding='utf-8'))['overall']['count'], 2)
            retry = subprocess.run(args, cwd=Path(__file__).resolve().parents[1], env=env, capture_output=True)
            self.assertNotEqual(retry.returncode, 0)

    def test_live_release_permissions_and_payload_rechecked_before_each_request(self):
        from test_dataset_release import DatasetReleaseTest
        from app.models.dialect import DialectContributionMeta as M, DialectRelease as R, DialectReleaseCard as RC
        from app.services.dataset_package import make_package
        from app.services.dataset_release import build_release
        from app.services.translation_permissions import validate_live_release
        fixture = DatasetReleaseTest(); fixture.setUp()
        try:
            for _ in range(24):
                fixture.add(kind='word', region='Hội An')
            plan = build_release(fixture.db, fixture.items)
            row = R(created_by=100, records=plan['records'], checksum=checksum(plan['records']))
            fixture.db.add(row); fixture.db.flush()
            fixture.db.add(RC(release_id=row.id, data_card=plan['data_card'], curated=True)); fixture.db.commit()
            document = prepare(make_package(row.id, row.created_at, row.records, plan['data_card']))
            self.assertEqual(len(document['cases']), 2)
            validate_live_release(document, fixture.db)
            changed = copy.deepcopy(document); changed['cases'][0]['source'] = 'changed'
            with self.assertRaisesRegex(ValueError, 'thay đổi câu'):
                validate_live_release(changed, fixture.db)
            changed = copy.deepcopy(document); changed['adaptation'][0]['target'] = 'changed'
            changed['adaptation_sha256'] = checksum(changed['adaptation'])
            with self.assertRaisesRegex(ValueError, 'Từ điển'):
                validate_live_release(changed, fixture.db)
            calls = []
            def handler(request):
                calls.append(request)
                meta = fixture.db.get(M, int(document['adaptation'][0]['id']))
                meta.consent = {'collect': True, 'train': False, 'version': 'dialect-2026-11-v1'}
                fixture.db.commit()
                return httpx.Response(200, json={'model': 'blaze-translate-1', 'output_text': 'test'})
            with BlazeTranslation('private-test-token', transport=httpx.MockTransport(handler)) as client:
                with self.assertRaisesRegex(ValueError, 'kiểm tra quyền'):
                    run_experiment(document, client)
                self.assertEqual(calls, [])
                with self.assertRaisesRegex(ValueError, 'Quyền, nội dung'):
                    run_experiment(document, client, authorize=lambda: validate_live_release(document, fixture.db))
                self.assertEqual(len(calls), 1)  # Revocation prevents the second outbound request.
        finally:
            fixture.tearDown()
