import unittest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.core.database import Base, get_db, utcnow
from app.models.user import User
from app.models.dialect import DialectContribution as C, DialectSource as S, DialectParticipant as DP, DialectVote as V, DialectEvent as E, DialectContributionMeta as M
from app.models.security import SecurityAuditEvent as Audit
from app.routers.deps import get_current_user
from app.routers.dialect_review_ops import router, enforce_region


class ReviewOpsTest(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine, expire_on_commit=False)()
        self.users = [User(email=f'op{i}@test.vn', full_name='QA', password_hash='x', role=r, account_status='active') for i,r in enumerate(['annotator','reviewer','reviewer','admin'])]
        self.db.add_all(self.users)
        self.db.flush()
        self.db.add(DP(user_id=self.users[1].id, review_region='A'))
        source = S(owner_id=self.users[0].id, evidence='QA')
        self.db.add(source)
        self.db.commit()
        self.sid=source.id
        self.current=self.users[1]
        app=FastAPI()
        app.include_router(router,prefix='/api')
        app.dependency_overrides[get_db]=lambda:self.db
        app.dependency_overrides[get_current_user]=lambda:self.current
        self.client=TestClient(app)

    def tearDown(self):
        self.client.close()
        self.db.close()
        self.engine.dispose()

    def item(self, **kwargs):
        values=dict(owner_id=self.users[0].id,source_id=self.sid,raw={'region':'A','consent_collect':True},status='RAW',idempotency_key=str(self.db.query(C).count()),request_hash='x')
        values.update(kwargs)
        row=C(**values)
        self.db.add(row)
        self.db.commit()
        return row

    def send(self,ids,action='HOLD',reason='Checked raw; inspect quality'):
        return self.client.post('/api/dialect/reviews/bulk',json=dict(ids=ids,action=action,reason=reason))

    def votes(self,item):
        for user,verdict in zip(self.users[1:3],['VERIFIED','REJECT']):
            self.db.add(V(contribution_id=item.id,reviewer_id=user.id,verdict=verdict,rubric={},note='QA'))
        item.status='REVIEW'
        self.db.commit()

    def test_hold_requeue_history_audit_raw_unchanged(self):
        item=self.item()
        raw=dict(item.raw)
        self.assertEqual(self.send([item.id]).status_code,200)
        self.assertEqual(item.status,'HOLD')
        self.assertEqual(self.send([item.id],'REQUEUE').status_code,200)
        self.assertEqual(item.status,'RAW')
        self.assertEqual(item.raw,raw)
        self.assertEqual(self.db.query(E).count(),2)
        self.assertEqual(self.db.query(Audit).filter(Audit.action.like('REVIEW_BULK_%')).count(),2)

    def test_atomic_withdrawn_failure_no_changes(self):
        a=self.item()
        b=self.item(raw={'region':'B','consent_collect':True},withdrawn_at=utcnow())
        self.assertEqual(self.send([a.id,b.id]).status_code,409)
        self.db.expire_all()
        self.assertEqual(a.status,'RAW')
        self.assertEqual(self.db.query(E).count(),0)
        self.assertEqual(self.db.query(Audit).filter(Audit.action.like('REVIEW_BULK_%')).count(),0)

    def test_self_unassigned_annotator_forbidden(self):
        item=self.item(owner_id=self.users[1].id)
        self.assertEqual(self.send([item.id]).status_code,403)
        self.current=self.users[2]
        self.assertEqual(self.send([item.id]).status_code,200)
        self.current=self.users[0]
        self.assertEqual(self.send([item.id]).status_code,403)

    def test_payload_bounds_no_bulk_verified(self):
        for ids,action,reason in [([], 'HOLD','x'),([1]*101,'HOLD','x'),([1,1],'HOLD','x'),([0],'HOLD','x'),([1],'VERIFIED','x'),([1],'HOLD','   ')]:
            self.assertEqual(self.send(ids,action,reason).status_code,422)

    def test_reject_requires_independent_admin_two_votes(self):
        item=self.item()
        self.assertEqual(self.send([item.id],'REJECT').status_code,409)
        self.current=self.users[3]
        self.assertEqual(self.send([item.id],'REJECT').status_code,409)
        self.votes(item)
        self.assertEqual(self.send([item.id],'REJECT').status_code,200)

    def test_admin_conflict_votes_block_requeue(self):
        item=self.item()
        self.votes(item)
        self.users[1].role='admin'
        self.db.commit()
        self.assertEqual(self.send([item.id],'REJECT').status_code,403)
        item.status='HOLD'
        self.db.commit()
        self.assertEqual(self.send([item.id],'REQUEUE').status_code,409)
        self.assertEqual(self.db.query(V).count(),2)

    def test_withdrawn_duplicate_superseded(self):
        item=self.item(withdrawn_at=utcnow())
        self.assertEqual(self.send([item.id]).status_code,409)
        item.withdrawn_at=None
        self.db.add(M(contribution_id=item.id,duplicate_of=item.id))
        self.db.commit()
        self.assertEqual(self.send([item.id]).status_code,409)
        self.db.get(M,item.id).duplicate_of=None
        self.db.commit()
        self.item(parent_id=item.id)
        self.assertEqual(self.send([item.id]).status_code,409)

    def test_curate_helper_region(self):
        item=self.item(raw={'region':'B'})
        enforce_region(self.db,self.users[1],item)
        with self.assertRaises(HTTPException):
            enforce_region(self.db,self.users[0],item)
        enforce_region(self.db,self.users[3],item)

    def test_commit_failure_rolls_back_history_and_audit(self):
        item=self.item()
        commit=self.db.commit
        def fail():
            self.db.flush()
            raise RuntimeError('storage failure')
        self.db.commit=fail
        with self.assertRaises(RuntimeError):
            self.send([item.id])
        self.db.commit=commit
        self.db.expire_all()
        self.assertEqual(item.status,'RAW')
        self.assertEqual(self.db.query(E).count(),0)
        self.assertEqual(self.db.query(Audit).filter(Audit.action.like('REVIEW_BULK_%')).count(),0)
