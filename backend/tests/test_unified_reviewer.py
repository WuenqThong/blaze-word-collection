import unittest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool
from app.main import app
from app.core.database import Base, get_db
from app.core.security import hash_password
from app.models import User

VOTE = dict(verdict='VERIFIED', meaning_ok=True, region_ok=True, context_ok=True, translation_ok=True, note='Đã đối chiếu')


class UnifiedReviewerTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        password = hash_password('Test-password-123')
        self.users = [User(email=f'merged-{i}@example.com', full_name=f'Merged {i}', role=role, account_status='active', password_hash=password)
                      for i, role in enumerate(('annotator', 'reviewer', 'admin', 'reviewer'))]
        self.db.add_all(self.users); self.db.commit()
        def database():
            try:
                yield self.db
            finally:
                self.db.rollback()
        app.dependency_overrides[get_db] = database
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close(); app.dependency_overrides.clear(); self.db.close(); self.engine.dispose()

    def login(self, index):
        response = self.client.post('/api/auth/login', json={'email': self.users[index].email, 'password': 'Test-password-123'})
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()['user']

    def sample(self):
        self.login(0)
        result = self.client.post('/api/dialect/contributions', json=dict(kind='word', original_text='mô', meaning='đâu', standard_vi='đâu', context='Đi mô?',
            region='Quảng Nam–Đà Nẵng', source_evidence='Synthetic fixture', consent_collect=True, consent_train=True,
            consent_version='demo-consent-v1', idempotency_key='merged-reviewer-sample'))
        self.assertEqual(result.status_code, 201, result.text)
        return result.json()['id']

    def test_same_management_access_and_canonical_public_role(self):
        for index in range(4):
            public = self.login(index)
            self.assertEqual(public['role'], 'annotator' if index == 0 else 'reviewer')
            for path in ('/sources', '/participants', '/releases', '/operations/summary'):
                self.assertEqual(self.client.get('/api/dialect' + path).status_code, 403 if index == 0 else 200)

    def test_two_blind_votes_then_independent_resolution_and_no_third_vote(self):
        cid = self.sample()
        self.login(1)
        self.assertEqual(self.client.post(f'/api/dialect/reviews/{cid}/votes', json=VOTE).status_code, 200)
        self.login(2)
        workspace = self.client.get('/api/dialect/workspace').json()
        self.assertEqual(next(c for c in workspace['contributions'] if c['id'] == cid)['votes'], [])
        self.assertEqual(self.client.post(f'/api/dialect/reviews/{cid}/votes', json={**VOTE, 'verdict': 'REJECT'}).status_code, 200)
        self.assertEqual(self.client.post(f'/api/dialect/reviews/{cid}/finalize', json={'verdict': 'VERIFIED', 'note': 'Review'}).status_code, 403)
        self.login(3)
        self.assertEqual(self.client.post(f'/api/dialect/reviews/{cid}/votes', json=VOTE).status_code, 409)
        self.assertEqual(self.client.post(f'/api/dialect/reviews/{cid}/finalize', json={'verdict': 'VERIFIED', 'note': 'Đối chiếu độc lập'}).status_code, 200)

    def test_participant_role_filter_groups_legacy_admins_with_reviewers(self):
        self.login(1)
        for role in ('reviewer', 'admin'):
            response = self.client.get('/api/dialect/participants', params={'role': role})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()['total'], 3)
            self.assertEqual({item['role'] for item in response.json()['items']}, {'reviewer'})
        response = self.client.get('/api/dialect/participants', params={'role': 'annotator'})
        self.assertEqual(response.json()['total'], 1)
        self.assertEqual(response.json()['items'][0]['role'], 'annotator')

    def test_last_reviewer_cannot_be_demoted_and_contributor_cannot_promote(self):
        self.login(0)
        self.assertEqual(self.client.put(f'/api/dialect/participants/{self.users[0].id}', json={'role': 'reviewer'}).status_code, 403)
        self.login(1)
        for index in (2, 3):
            response = self.client.put(f'/api/dialect/participants/{self.users[index].id}', json={'role': 'annotator'})
            self.assertEqual(response.status_code, 200, response.text)
        for method, path in [('PUT', f'/api/dialect/participants/{self.users[1].id}'), ('POST', f'/api/dialect/participants/{self.users[1].id}/role')]:
            self.assertEqual(self.client.request(method, path, json={'role': 'annotator'}).status_code, 409)
