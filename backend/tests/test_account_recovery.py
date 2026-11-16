import json
from datetime import timedelta
import unittest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.main import app
from app.core.database import Base, get_db, utcnow
from app.core.security import hash_password
from app.models import User
from app.models.security import PasswordRecovery, SecurityAuditEvent
from app.services.account_recovery import issue_recovery


class AccountRecoveryTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine)()
        self.admin = User(email='admin@example.com', full_name='Admin', role='admin', account_status='active', password_hash=hash_password('Old-admin-123'))
        self.user = User(email='user@example.com', full_name='User', role='annotator', account_status='active', password_hash=hash_password('Old-user-123'))
        self.db.add_all([self.admin, self.user]); self.db.commit()
        app.dependency_overrides[get_db] = lambda: self.db
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close(); app.dependency_overrides.clear(); self.db.close(); self.engine.dispose()

    def token(self):
        token = issue_recovery(self.db, self.admin, self.user)
        self.db.commit()
        return token

    def test_one_use_expiry_reissue_and_old_session_revocation(self):
        self.assertEqual(self.client.post('/api/auth/login', json={'email': self.user.email, 'password': 'Old-user-123'}).status_code, 200)
        from app.core.config import get_settings
        cookie_name = get_settings().cookie_name
        old_cookie = self.client.cookies.get(cookie_name)
        replaced = self.token()
        token = self.token()
        self.assertEqual(self.client.post('/api/auth/reset-password', json={'token': replaced, 'new_password': 'New-user-456'}).status_code, 400)
        response = self.client.post('/api/auth/reset-password', json={'token': token, 'new_password': 'New-user-456'})
        self.assertEqual(response.status_code, 204, response.text)
        self.assertEqual(self.client.post('/api/auth/reset-password', json={'token': token, 'new_password': 'Again-user-789'}).status_code, 400)
        self.client.cookies.set(cookie_name, old_cookie)
        self.assertEqual(self.client.get('/api/auth/me').status_code, 401)
        self.client.cookies.clear()
        self.assertEqual(self.client.post('/api/auth/login', json={'email': self.user.email, 'password': 'Old-user-123'}).status_code, 401)
        self.assertEqual(self.client.post('/api/auth/login', json={'email': self.user.email, 'password': 'New-user-456'}).status_code, 200)
        expired = self.token()
        row = self.db.query(PasswordRecovery).filter_by(used_at=None).one()
        row.expires_at = utcnow() - timedelta(seconds=1); self.db.commit()
        self.assertEqual(self.client.post('/api/auth/reset-password', json={'token': expired, 'new_password': 'Other-user-789'}).status_code, 400)
        serialized = json.dumps([r.details for r in self.db.query(SecurityAuditEvent)], default=str)
        self.assertNotIn(token, serialized)
        self.assertNotIn('New-user-456', serialized)
        self.assertNotIn(self.user.password_hash, serialized)
        self.assertTrue(self.db.query(SecurityAuditEvent).filter_by(action='RECOVERY_CONSUMED').count())

    def test_non_admin_cannot_issue_and_audit_is_admin_only(self):
        from fastapi import HTTPException
        with self.assertRaises(HTTPException): issue_recovery(self.db, self.user, self.admin)
        self.client.post('/api/auth/login', json={'email': self.user.email, 'password': 'Old-user-123'})
        self.assertEqual(self.client.get('/api/dialect/audit').status_code, 403)
        self.client.post('/api/auth/login', json={'email': self.admin.email, 'password': 'Old-admin-123'})
        self.assertEqual(self.client.post(f'/api/dialect/participants/{self.user.id}/role', json={'role': 'reviewer'}).status_code, 200)
        response = self.client.get('/api/dialect/audit')
        self.assertEqual(response.status_code, 200)
        events = response.json()['items']
        self.assertTrue(any(e['actor_id'] == self.admin.id and e['details'].get('role') == 'reviewer' and e['request_id'] for e in events))

    def test_rolled_back_role_change_has_no_durable_audit(self):
        before = self.db.query(SecurityAuditEvent).count()
        self.user.role = 'reviewer'; self.db.flush(); self.db.rollback()
        self.assertEqual(self.db.query(SecurityAuditEvent).count(), before)

    def test_audit_covers_rights_consent_release_policy_and_credits_without_content(self):
        from app.models.dialect import (DialectSource, DialectSourceRights, DialectContribution,
                                        DialectContributionMeta, DialectRelease, DialectCredit, DialectSetting)
        self.db.info['actor_id'] = self.admin.id
        self.db.info['request_id'] = 'audit-test-request'
        source = DialectSource(owner_id=self.user.id, evidence='PRIVATE CONTENT', rights_confirmed=True)
        self.db.add(source); self.db.flush()
        contribution = DialectContribution(owner_id=self.user.id, source_id=source.id,
            idempotency_key='audit-sample', request_hash='hash', raw={'original_text': 'PRIVATE CONTENT'}, status='VERIFIED')
        self.db.add(contribution); self.db.flush()
        self.db.add_all([
            DialectSourceRights(source_id=source.id, title='PRIVATE CONTENT', public=False, audio=False),
            DialectContributionMeta(contribution_id=contribution.id,
                consent={'collect': True, 'train': True, 'public': False, 'audio': False}, curated={'text': 'PRIVATE CONTENT'}),
            DialectRelease(created_by=self.admin.id, records=[{'id': contribution.id, 'text': 'PRIVATE CONTENT'}], checksum='checksum'),
            DialectSetting(key='reward_policy', value={'private_value': 'PRIVATE CONTENT'}),
            DialectCredit(user_id=self.user.id, contribution_id=contribution.id, amount=5, used=0,
                          expires_at=utcnow() + timedelta(days=30), granted_by=self.admin.id),
        ])
        self.db.commit()
        rows = self.db.query(SecurityAuditEvent).filter_by(request_id='audit-test-request').all()
        kinds = {row.entity_type for row in rows}
        self.assertTrue({'dialect_sources', 'dialect_source_rights', 'dialect_contribution_meta',
                         'dialect_releases', 'dialect_settings', 'dialect_credits'} <= kinds)
        self.assertTrue(all(row.actor_id == self.admin.id for row in rows))
        self.assertNotIn('PRIVATE CONTENT', json.dumps([row.details for row in rows]))
