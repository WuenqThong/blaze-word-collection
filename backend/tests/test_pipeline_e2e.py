"""Real-cookie pipeline acceptance tests, isolated before any application import."""
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


SCENARIOS = r'''
import json
import time
import unittest
from unittest.mock import patch
from contextlib import ExitStack
from fastapi.testclient import TestClient
from jose import jwt
from app.main import app
from app.core.database import SessionLocal, engine
from app.core.config import get_settings
from app.models.user import User
from app.models.dialect import DialectContribution, DialectGameReceipt, DialectVote

API = '/api/dialect'
CONSENT = dict(collect=True, train=True, public=False, audio=False, version='demo-consent-v1')
VOTE = dict(verdict='VERIFIED', meaning_ok=True, region_ok=True, context_ok=True,
            translation_ok=True, note='Independent QA verification')

class Pipeline(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.stack = ExitStack()
        cls.clients = [cls.stack.enter_context(TestClient(app)) for _ in range(5)]
        cls.ids = []
        for i, client in enumerate(cls.clients):
            r = client.post('/api/auth/register', json=dict(email=f'pipeline{i}@example.com',
                full_name=f'Pipeline QA {i}', password='Temporary-pipeline-123'))
            assert r.status_code == 201, r.text
            cls.ids.append(r.json()['user']['id'])
        # Bootstrap privileges in the disposable DB only. Every request still runs real auth.
        with SessionLocal() as db:
            db.get(User, cls.ids[3]).role = 'admin'
            db.commit()
        cls.owner, cls.r1, cls.r2, cls.admin, cls.other = cls.clients
        for index in (1, 2):
            r = cls.admin.put(API + f'/participants/{cls.ids[index]}',
                             json=dict(role='reviewer', review_region='Hội An'))
            assert r.status_code == 200, r.text
        assert not app.dependency_overrides, 'No auth/database overrides permitted'

    @classmethod
    def tearDownClass(cls):
        cls.stack.close()
        engine.dispose()

    def request(self, client, method, path, expected=200, **kwargs):
        r = client.request(method, API + path, **kwargs)
        self.assertEqual(r.status_code, expected, f'{method} {path}: {r.text}')
        return r.json() if r.content else None

    def body(self, key, text='mô', **extra):
        return dict(kind='word', original_text=text, meaning='đâu', standard_vi='đâu',
            region='Hội An', context='Đi mô rứa?', source_evidence='Synthetic QA family ' + key,
            consent_collect=True, consent_train=True, consent_version='demo-consent-v1',
            idempotency_key=key, **extra)

    def create(self, key, text='mô', **extra):
        return self.request(self.owner, 'POST', '/contributions', 201, json=self.body(key, text, **extra))

    def eligible(self, item):
        cid = item['id']
        first = self.request(self.r1, 'POST', f'/reviews/{cid}/votes', json=VOTE)
        self.assertEqual(first['status'], 'REVIEW')
        self.request(self.r1, 'POST', f'/reviews/{cid}/votes', 409, json=VOTE)
        # Reviewer two sees neither first reviewer's vote nor client-owned request key.
        page = self.request(self.r2, 'GET', '/reviews')
        unseen = next(c for c in page['items'] if c['id'] == cid)
        self.assertEqual(unseen['votes'], [])
        self.assertIsNone(unseen['client_ref'])
        second = self.request(self.r2, 'POST', f'/reviews/{cid}/votes', json=VOTE)
        self.assertEqual(second['status'], 'VERIFIED')
        self.assertEqual(second['vote_count'], 2)
        self.request(self.owner, 'POST', f'/sources/{item["source_id"]}/rights', 403,
                     json=dict(rights_confirmed=True, note='QA'))
        self.request(self.admin, 'POST', '/releases', 409, json=dict(ids=[cid]))
        self.request(self.admin, 'POST', f'/sources/{item["source_id"]}/rights',
                     json=dict(rights_confirmed=True, note='Synthetic QA source confirmed', public=False))
        self.request(self.admin, 'POST', '/releases', 409, json=dict(ids=[cid]))
        curated = self.request(self.admin, 'POST', f'/reviews/{cid}/curate', json=dict(raw=dict(
            text=item['raw']['original_text'], meaning='đâu', standard='đâu', context='Đi mô rứa?', region='Hội An')))
        self.assertEqual(curated['raw'], item['raw'], 'CURATED must preserve RAW')

    def release(self, items):
        ids = [c['id'] for c in items]
        preview = self.request(self.admin, 'GET', '/releases/preview')
        self.assertGreaterEqual(preview['eligible_count'], len(ids))
        created = self.request(self.admin, 'POST', '/releases', 201, json=dict(ids=ids,
            splits={str(cid): 'test' for cid in ids}, data_card='Untrusted client card'))
        download = self.request(self.admin, 'GET', f'/releases/{created["id"]}')
        self.assertEqual(download, self.request(self.admin, 'GET', f'/releases/{created["id"]}'))
        self.assertEqual({r['id'] for r in download['records']}, set(ids))
        self.assertTrue(all(r['curated'] for r in download['records']))
        # All records belong to one contributor: never split this connected group.
        self.assertEqual({r['split'] for r in download['records']}, {'train'})
        card = json.loads(download['manifest']['data_card'])
        self.assertTrue(card['provenance'])
        self.assertTrue(card['usage'])
        self.assertNotEqual(download['manifest']['data_card'], 'Untrusted client card')
        return created['id']

    def test_01_vertical_and_training_consent_revocation(self):
        ref = 'qa-vertical-session'
        allocation = dict(session_ref=ref, exam_ids=['qa-dataset1-01'])
        allocated = self.request(self.owner, 'POST', '/allocation', json=allocation)
        self.assertEqual(allocated['exam_id'], 'qa-dataset1-01')
        self.request(self.owner, 'POST', f'/sessions/{ref}/submitted', 409)
        for _ in range(2):
            self.request(self.owner, 'POST', f'/sessions/{ref}/started')
        for _ in range(2):
            self.request(self.owner, 'POST', f'/sessions/{ref}/submitted')
        stats = self.request(self.owner, 'GET', '/statistics')
        self.assertEqual(stats['started_sessions'], 1)
        self.assertEqual(stats['submitted_sessions'], 1)
        self.assertEqual(stats['valid_samples'], 0)
        game = self.create('qa-vertical-game-q3', 'mô', method='game', session_ref=ref)
        direct = self.create('qa-vertical-direct', 'tê')
        for item in (game, direct):
            self.assertEqual(item['status'], 'RAW', 'Short dialect words remain valid')
            self.eligible(item)
        self.assertEqual(self.request(self.owner, 'GET', '/statistics')['valid_samples'], 2)
        rid = self.release([game, direct])
        self.request(self.owner, 'POST', f'/contributions/{direct["id"]}/consent',
                     json=dict(consent={**CONSENT, 'train': False}))
        self.request(self.admin, 'GET', f'/releases/{rid}', 409)
        with SessionLocal() as db:
            self.assertEqual(db.query(DialectGameReceipt).filter_by(session_ref=ref).count(), 1)
            self.assertEqual(db.query(DialectVote).filter_by(contribution_id=game['id']).count(), 2)

    def test_02_withdraw_invalidates_existing_release(self):
        item = self.create('qa-withdraw-release', 'răng')
        self.eligible(item)
        rid = self.release([item])
        self.request(self.owner, 'POST', f'/contributions/{item["id"]}/consent',
                     json=dict(consent=CONSENT, withdraw=True))
        self.request(self.admin, 'GET', f'/releases/{rid}', 409)
        self.request(self.owner, 'POST', f'/contributions/{item["id"]}/consent', 409,
                     json=dict(consent=CONSENT))

    def test_03_idempotency_and_cross_account_isolation(self):
        item = self.create('qa-idempotent-key', 'ni')
        again = self.create('qa-idempotent-key', 'ni')
        self.assertEqual(item['id'], again['id'])
        self.request(self.owner, 'POST', '/contributions', 409,
                     json=self.body('qa-idempotent-key', 'khác'))
        with SessionLocal() as db:
            self.assertEqual(db.query(DialectContribution).filter_by(
                owner_id=self.ids[0], idempotency_key='qa-idempotent-key').count(), 1)
        self.request(self.other, 'POST', f'/contributions/{item["id"]}/consent', 403,
                     json=dict(consent=CONSENT))
        self.request(self.other, 'POST', '/contributions', 403,
                     json={**self.body('qa-foreign-parent'), 'parent_id': item['id']})
        ws = self.request(self.other, 'GET', '/workspace')
        self.assertNotIn(item['id'], [c['id'] for c in ws['contributions']])
        own_copy = self.request(self.other, 'POST', '/contributions', 201,
                                json=self.body('qa-idempotent-key', 'ni'))
        self.assertNotEqual(own_copy['id'], item['id'])
        self.assertEqual(own_copy['owner_id'], self.ids[4])
        ref = 'qa-owned-ref'
        allocation = dict(session_ref=ref, exam_ids=['qa-isolation-exam'])
        self.request(self.owner, 'POST', '/allocation', json=allocation)
        self.request(self.other, 'POST', '/allocation', 409, json=allocation)
        for endpoint in ('started', 'submitted'):
            r = self.other.post(API + f'/sessions/{ref}/{endpoint}')
            self.assertIn(r.status_code, (403, 404, 409), r.text)
        foreign = self.other.post(API + '/contributions', json=self.body(
            'qa-foreign-session', 'hỉ', method='game', session_ref=ref))
        self.assertIn(foreign.status_code, (403, 404, 409), foreign.text)
        self.request(self.owner, 'POST', f'/sessions/{ref}/started')
        self.request(self.owner, 'POST', f'/sessions/{ref}/withdraw')
        self.request(self.owner, 'POST', f'/sessions/{ref}/started', 409)
        self.request(self.owner, 'POST', f'/sessions/{ref}/submitted', 409)

    def test_04_suspicious_hold_and_reasoned_bulk_requeue(self):
        item = self.create('qa-suspicious-chars', 'mô\u200b')
        self.assertEqual(item['status'], 'HOLD')
        self.assertIn('invalid_control', item['quality_reasons'])
        self.assertEqual(item['raw']['original_text'], 'mô\u200b')
        cid = item['id']
        self.request(self.r1, 'POST', f'/reviews/{cid}/votes', 409, json=VOTE)
        body = dict(ids=[cid], action='REQUEUE', reason='Confirmed synthetic formatting artifact; resume review')
        self.request(self.owner, 'POST', '/reviews/bulk', 403, json=body)
        self.request(self.admin, 'POST', '/reviews/bulk', 422, json={**body, 'reason': '  '})
        result = self.request(self.admin, 'POST', '/reviews/bulk', json=body)
        self.assertEqual(result['updated'], 1)
        ws = self.request(self.owner, 'GET', '/workspace')
        updated = next(c for c in ws['contributions'] if c['id'] == cid)
        self.assertEqual(updated['status'], 'RAW')
        self.assertTrue(any(e['action'] == 'BULK_REQUEUE' and e['note'] == body['reason']
                            for e in updated['events']))
        audit = self.request(self.admin, 'GET', '/audit')
        self.assertTrue(any(e['action'] == 'REVIEW_BULK_REQUEUE' and e['request_id'] for e in audit['items']))

    def test_05_transient_429_retry_without_duplicate(self):
        from app.core.http_security import HttpSecurityMiddleware
        middleware = app.middleware_stack
        while not isinstance(middleware, HttpSecurityMiddleware):
            middleware = middleware.app
        settings = get_settings()
        old_limit, old_window = settings.rate_limit_contributions, settings.rate_limit_window_seconds
        try:
            settings.rate_limit_contributions = 1
            settings.rate_limit_window_seconds = 60
            # Deterministic time windows, real SQLite limiter; no sleep and no auth override.
            with patch.object(middleware, 'clock', return_value=time.time() + 86400):
                item = self.create('qa-throttled-idempotency', 'hè')
                response = self.owner.post(API + '/contributions', json=self.body('qa-throttled-idempotency', 'hè'))
                self.assertEqual(response.status_code, 429, response.text)
                self.assertGreater(int(response.headers['retry-after']), 0)
            with patch.object(middleware, 'clock', return_value=time.time() + 86520):
                retry = self.create('qa-throttled-idempotency', 'hè')
                self.assertEqual(retry['id'], item['id'])
            with SessionLocal() as db:
                self.assertEqual(db.query(DialectContribution).filter_by(
                    owner_id=self.ids[0], idempotency_key='qa-throttled-idempotency').count(), 1)
        finally:
            settings.rate_limit_contributions, settings.rate_limit_window_seconds = old_limit, old_window

    def test_06_real_cookie_logout_and_expired_session(self):
        with TestClient(app) as client:
            self.assertEqual(client.get('/api/auth/me').status_code, 401)
            self.assertEqual(client.get(API + '/workspace').status_code, 401)
            r = client.post('/api/auth/login', json=dict(email='pipeline4@example.com', password='Temporary-pipeline-123'))
            self.assertEqual(r.status_code, 200, r.text)
            self.assertIn('HttpOnly', r.headers['set-cookie'])
            self.assertEqual(client.get('/api/auth/me').status_code, 200)
            from app.core.security import decode_token
            real_claims = decode_token(client.cookies.get(get_settings().cookie_name))
            self.assertEqual(client.post('/api/auth/logout').status_code, 204)
            self.assertEqual(client.get(API + '/workspace').status_code, 401)
            settings = get_settings()
            expired = jwt.encode({**real_claims, 'iat': int(time.time())-120, 'exp': int(time.time())-60},
                                 settings.jwt_secret, algorithm=settings.jwt_alg)
            client.cookies.clear()
            client.cookies.set(settings.cookie_name, expired)
            self.assertEqual(client.get('/api/auth/me').status_code, 401)
            self.assertEqual(client.post(API + '/allocation', json=dict(
                session_ref='qa-expired-ref', exam_ids=['qa-expired'])).status_code, 401)

    def test_07_one_character_word_and_required_training_consent(self):
        item = self.create('qa-one-character-valid', 'á')
        self.assertEqual(item['status'], 'RAW')
        self.request(self.owner, 'POST', '/contributions', 422,
                     json={**self.body('qa-no-training-consent'), 'consent_train': False})

unittest.main(verbosity=2)
'''


class PipelineE2ETests(unittest.TestCase):
    def test_full_pipeline_real_cookie_auth_in_temporary_sqlite(self):
        with tempfile.TemporaryDirectory(prefix='blaze-pipeline-e2e-') as directory:
            env = dict(os.environ, DATABASE_URL='sqlite:///' + Path(directory, 'pipeline.db').as_posix(),
                       ENVIRONMENT='test', DEBUG='false', ENABLE_LEGACY='false', COOKIE_SECURE='false',
                       COOKIE_SAMESITE='lax', RATE_LIMIT_ENABLED='true', RATE_LIMIT_AUTH='1000',
                       RATE_LIMIT_CONTRIBUTIONS='1000', JWT_SECRET='ephemeral-pipeline-e2e-secret-123456789')
            result = subprocess.run([sys.executable, '-c', SCENARIOS], env=env,
                                    cwd=Path(__file__).resolve().parents[1], capture_output=True,
                                    text=True, encoding='utf-8', errors='replace', timeout=180)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


if __name__ == '__main__':
    unittest.main()
