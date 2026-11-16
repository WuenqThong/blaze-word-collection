import unittest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.database import Base, utcnow
from app.models import User
from app.models.dialect import DialectSource, DialectContribution, DialectContributionMeta
from app.routers.dialect import find_game_duplicate


class DuplicateBatchTests(unittest.TestCase):
    def test_batch_matches_legacy_and_does_not_reuse_index_after_commit_or_rollback(self):
        engine=create_engine('sqlite://')
        Base.metadata.create_all(engine)
        with sessionmaker(bind=engine)() as db:
            user=User(email='batch@example.com',full_name='Synthetic',password_hash='not-used',role='annotator',account_status='active')
            db.add(user);db.flush()
            source=DialectSource(owner_id=user.id,evidence='Synthetic fixture');db.add(source);db.flush()
            def sample(text,key):
                row=DialectContribution(owner_id=user.id,source_id=source.id,idempotency_key=key,request_hash=key,raw={'kind':'word','original_text':text,'meaning':'đâu','standard_vi':'ở đâu','context':'Mi đi mô?','region':'TP. Hội An'})
                db.add(row);db.flush();return row
            first=sample('MÔ','first');db.commit()
            incoming=sample('mo\u0302','second')
            self.assertEqual(find_game_duplicate(db,incoming).id,first.id)
            self.assertEqual(find_game_duplicate(db,incoming,batch=True).id,first.id)
            db.add(DialectContributionMeta(contribution_id=incoming.id,duplicate_of=first.id));db.flush()
            fresh=sample('rứa','third')
            self.assertIsNone(find_game_duplicate(db,fresh,batch=True))
            self.assertIsNone(find_game_duplicate(db,fresh,batch=True))
            same=sample('RỨA','fourth')
            self.assertEqual(find_game_duplicate(db,same,batch=True).id,fresh.id)
            db.rollback()
            # The rolled-back rows must never remain duplicate candidates.
            again=sample('rứa','after-rollback')
            self.assertIsNone(find_game_duplicate(db,again,batch=True))
            db.commit()
            again.withdrawn_at=utcnow();db.commit()
            after_withdrawal=sample('rứa','after-withdrawal')
            self.assertIsNone(find_game_duplicate(db,after_withdrawal,batch=True))
        engine.dispose()
