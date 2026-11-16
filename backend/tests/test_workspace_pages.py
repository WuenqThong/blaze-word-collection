import unittest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.main import app
from app.core.database import Base, get_db
from app.models import User
from app.models.dialect import DialectContribution as C, DialectSource as S, DialectFeedback as F
from app.routers.deps import get_current_user


class WorkspacePaginationTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine)()
        self.users = [User(full_name=f'User {n}', email=f'user{n}@example.com', password_hash='test', role=role, account_status='active')
                      for n, role in enumerate(('admin', 'annotator', 'reviewer'))]
        self.db.add_all(self.users); self.db.commit()
        self.current = self.users[0]
        app.dependency_overrides[get_db] = lambda: self.db
        app.dependency_overrides[get_current_user] = lambda: self.current
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close(); app.dependency_overrides.clear(); self.db.close(); self.engine.dispose()

    def seed(self, count):
        source = S(owner_id=self.users[1].id, evidence='QA source')
        self.db.add(source); self.db.flush()
        self.db.bulk_insert_mappings(C, [dict(owner_id=self.users[1].id, source_id=source.id,
            idempotency_key=f'page-sample-{n}', request_hash=f'hash-{n}', raw={'kind':'word', 'original_text':'mô', 'meaning':'đâu', 'region':'Hội An'}) for n in range(count)])
        self.db.commit()

    def test_more_than_1000_rows_no_loss_duplicates_or_concurrent_insert_drift(self):
        self.seed(1205)
        response = self.client.get('/api/dialect/workspace?limit=200').json()
        ids = [c['id'] for c in response['contributions']]
        source = self.db.query(S).first()
        self.db.add(C(owner_id=self.users[1].id, source_id=source.id, idempotency_key='later', request_hash='later', raw={'original_text':'chi'})); self.db.commit()
        cursor = response['next_cursor']; pages = 1
        while cursor:
            response = self.client.get('/api/dialect/workspace', params={'limit':200, 'cursor':cursor})
            self.assertEqual(response.status_code, 200, response.text)
            response = response.json(); ids += [c['id'] for c in response['contributions']]
            cursor = response['next_cursor']; pages += 1
            self.assertLess(pages, 10)
        self.assertEqual(len(ids), 1205)
        self.assertEqual(len(set(ids)), 1205)
        self.assertNotIn(1206, ids)

    def test_all_streams_bounded_and_cursor_bound_to_account(self):
        self.seed(7)
        self.db.add_all([S(owner_id=self.users[1].id, evidence=f'Source {i}') for i in range(7)])
        self.db.add_all([F(user_id=self.users[1].id, entity=f'qa-{i}', text='QA feedback') for i in range(7)])
        self.db.commit()
        first = self.client.get('/api/dialect/workspace?limit=2').json()
        for key in ('contributions','sources','people','credits','releases','feedback'):
            self.assertLessEqual(len(first[key]), 2)
        cursor = first['next_cursor']
        self.assertEqual(self.client.get('/api/dialect/workspace', params={'cursor':cursor+'x'}).status_code, 400)
        self.current = self.users[1]
        self.assertEqual(self.client.get('/api/dialect/workspace', params={'cursor':cursor}).status_code, 400)
        mine = self.client.get('/api/dialect/workspace?limit=2').json()
        self.assertTrue(all(c['owner_id'] == self.current.id for c in mine['contributions']))
        self.assertEqual(self.client.get('/api/dialect/workspace?limit=201').status_code, 422)

    def test_counts_use_explicit_receipts_including_zero_sample_submissions(self):
        self.seed(1)  # A sample alone must never be counted as a submitted game.
        self.current = self.users[1]
        self.assertEqual(self.client.get('/api/dialect/statistics').json()['submitted_sessions'], 0)
        self.client.post('/api/dialect/allocation', json={'session_ref':'zero-samples', 'exam_ids':['exam-a']})
        self.assertEqual(self.client.post('/api/dialect/sessions/zero-samples/submitted').status_code, 409)
        for _ in range(2):
            self.assertEqual(self.client.post('/api/dialect/sessions/zero-samples/started').status_code, 200)
            self.assertEqual(self.client.post('/api/dialect/sessions/zero-samples/submitted').status_code, 200)
        stats = self.client.get('/api/dialect/statistics').json()
        self.assertEqual((stats['started_sessions'],stats['submitted_sessions']), (1,1))
        self.current = self.users[2]
        self.assertEqual(self.client.post('/api/dialect/sessions/zero-samples/started').status_code, 404)
        self.assertEqual(self.client.get('/api/dialect/statistics').json()['started_sessions'], 1)
        self.current = self.users[1]
        self.client.post('/api/dialect/sessions/zero-samples/withdraw')
        stats = self.client.get('/api/dialect/statistics').json()
        self.assertEqual(stats['withdrawn_sessions'],1)
        self.assertEqual(stats['submitted_sessions'],1)

    def test_expected_owner_guard_prevents_cookie_switch_from_reassigning_raw(self):
        self.current = self.users[1]
        body = dict(kind='word', original_text='mô', meaning='đâu', standard_vi='đâu', context='Đi mô rứa',
                    region='Hội An', source_evidence='QA', consent_collect=True, consent_train=True,
                    consent_version='demo-consent-v1', idempotency_key='expected-account-guard', expected_owner_id=self.users[2].id)
        self.assertEqual(self.client.post('/api/dialect/contributions', json=body).status_code, 409)
        self.assertEqual(self.db.query(C).count(), 0)
        self.assertEqual(self.client.post('/api/dialect/contributions', json={k:v for k,v in body.items() if k != 'expected_owner_id'},
                                         headers={'X-Account-ID': str(self.users[2].id)}).status_code, 409)
        self.assertEqual(self.db.query(C).count(), 0)
        body['expected_owner_id'] = self.current.id
        result = self.client.post('/api/dialect/contributions', json=body)
        self.assertEqual(result.status_code, 201, result.text)
        self.assertNotIn('expected_owner_id', result.json()['raw'])
        body.pop('expected_owner_id')
        self.assertEqual(self.client.post('/api/dialect/contributions', json=body).json()['id'], result.json()['id'])
