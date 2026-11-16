import unittest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.main import app
from app.core.database import Base, get_db
from app.core.security import hash_password
from app.models import User
from app.models.dialect import DialectContribution as C, DialectSource as S, DialectVote as V, DialectContributionMeta as M


class PilotOperationsTests(unittest.TestCase):
    def test_real_cookie_admin_only_aggregate_and_unknown_offline_count(self):
        engine=create_engine('sqlite://',connect_args={'check_same_thread':False},poolclass=StaticPool)
        Base.metadata.create_all(engine)
        db=sessionmaker(bind=engine)()
        def database():
            try: yield db
            finally: db.rollback()
        app.dependency_overrides[get_db]=database
        try:
            hashed=hash_password('PilotOps123!')
            people=[User(email=f'ops-{i}@example.com',full_name=f'Ops {i}',password_hash=hashed,role=role,account_status='active') for i,role in enumerate(['annotator','reviewer','reviewer','admin'])]
            db.add_all(people);db.flush()
            source=S(owner_id=people[0].id,evidence='Synthetic operations fixture');db.add(source);db.flush()
            first=C(owner_id=people[0].id,source_id=source.id,idempotency_key='ops-first',request_hash='first',status='REVIEW',raw={'region':'TP. Hội An','original_text':'mô','consent_collect':True,'consent_train':True})
            second=C(owner_id=people[0].id,source_id=source.id,idempotency_key='ops-second',request_hash='second',status='HOLD',raw={'region':'Quận Hải Châu','original_text':'mô'})
            db.add_all([first,second]);db.flush()
            db.add(M(contribution_id=second.id,duplicate_of=first.id))
            for reviewer,verdict in [(people[1],'VERIFIED'),(people[2],'REJECT')]:db.add(V(contribution_id=first.id,reviewer_id=reviewer.id,verdict=verdict,rubric={},note='Synthetic vote'))
            db.commit()
            with TestClient(app) as client:
                self.assertEqual(client.get('/api/dialect/operations/summary').status_code,401)
                for user in people:
                    result=client.post('/api/auth/login',json={'email':user.email,'password':'PilotOps123!'})
                    self.assertEqual(result.status_code,200)
                    response=client.get('/api/dialect/operations/summary')
                    if user.role not in ('admin','reviewer'):self.assertEqual(response.status_code,403);continue
                    self.assertEqual(response.status_code,200,response.text)
                    data=response.json()
                    self.assertEqual(data['pilot_people'],20)
                    self.assertEqual(data['samples'],2)
                    self.assertEqual(data['pending_review'],1)
                    self.assertEqual(data['duplicates'],1)
                    self.assertEqual(data['unresolved_disagreements'],1)
                    self.assertEqual(data['by_region'],{'TP. Hội An':1,'Quận Hải Châu':1})
                    self.assertIsNone(data['pending_sync'])
                    self.assertEqual(data['targets']['samples'],1000)
                    self.assertEqual(data['targets']['review_hours'],48)
                    self.assertEqual(data['targets_status'],'approved')
                    self.assertEqual(data['pilot_evaluation']['status'],'not_started')
                    self.assertEqual(data['independent_quality_assessment'],'not_recorded')
                    self.assertEqual(data['assessment']['scope'], 'whole_database')
                    self.assertEqual(len(data['assessment']['kpis']), 6)
                    self.assertTrue(all(k['status'] == 'insufficient_evidence' for k in data['assessment']['kpis']))
                    self.assertEqual(data['assessment']['next_release']['status'], 'pending')
                    self.assertEqual(len(data['assessment']['reviewer_gaps']), 0)
                    self.assertNotIn('email',response.text)
                    self.assertIn('process-last-hour',response.text)
        finally:
            app.dependency_overrides.clear();db.close();engine.dispose()

    def test_timing_counts_hold_and_late_decisions_without_fabricating_missing_history(self):
        from datetime import timedelta
        from app.core.database import utcnow
        from app.models.dialect import DialectEvent as E, DialectParticipant as P
        from app.services.pilot_assessment import assessment
        engine = create_engine('sqlite://')
        Base.metadata.create_all(engine)
        now = utcnow()
        with sessionmaker(bind=engine)() as db:
            people = [User(email=f'timing-{i}@example.com', full_name='Test', password_hash='not-used', role='reviewer', account_status='active') for i in range(3)]
            people[-1].account_status = 'suspended'
            db.add_all(people); db.flush()
            db.add_all([P(user_id=u.id, review_region='Region A') for u in people])
            source = S(owner_id=people[0].id, evidence='Synthetic timing fixture')
            db.add(source); db.flush()
            items = []
            for i, (status, age) in enumerate([('HOLD', 49), ('RAW', 48), ('VERIFIED', 100), ('REJECT', 100), ('VERIFIED', 100), ('HOLD', 200)]):
                item = C(owner_id=people[0].id, source_id=source.id, idempotency_key=f'timing-{i}', request_hash=str(i), status=status, created_at=now-timedelta(hours=age), raw={'region': 'Region A' if i % 2 == 0 else 'Region B'})
                db.add(item); items.append(item)
            db.flush()
            # A late final decision cannot be hidden by an earlier event; bulk rejection also counts.
            for index, action, hours in [(2, 'VERIFIED', 40), (2, 'VERIFIED', 49), (3, 'BULK_REJECT', 48)]:
                db.add(E(contribution_id=items[index].id, actor_id=people[0].id, action=action, note='Test decision', created_at=items[index].created_at+timedelta(hours=hours)))
            db.commit()
            result = assessment(db, items, {items[-1].id}, now)
            timing = result['review_timing']
            self.assertEqual(timing['completed'], 3)
            self.assertEqual(timing['measured'], 2)
            self.assertEqual(timing['missing_history'], 1)
            self.assertEqual(timing['completed_late'], 1)
            self.assertEqual(timing['pending_late'], 1)
            self.assertEqual(timing['oldest_waiting_hours'], 49)
            self.assertEqual(timing['max_completed_hours'], 49)
            self.assertEqual(result['reviewer_gaps'], [{'region': 'Region A', 'reviewers': 1}, {'region': 'Region B', 'reviewers': 1}])
        engine.dispose()
