import copy
import unittest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from app.core.database import Base
from app.models import User
from app.models.dialect import DialectContribution as C, DialectSource as S, DialectVote as V, DialectEvent as E
from app.services.dataset_candidate_import import import_candidates, plan_candidates
from app.routers.dialect import eligible

SHEET = 'company-sheet'


def candidate(cid='CS-001', suffix=''):
    return {'original_id': cid, 'sheet_id': 17, 'sheet': 'Câu đối chiếu', 'row': 2,
            'source_url': f'https://docs.google.com/spreadsheets/d/{SHEET}/edit#gid=17&range=A2',
            'disposition': 'sentence_pair_candidate_needs_review', 'training_eligible': False,
            'rights_status': 'unconfirmed', 'native_review_status': 'pending',
            'source_text': 'Anh đi mô?' + suffix, 'target_text': 'Anh đi đâu?' + suffix, 'meaning': 'đâu',
            'region': 'Quảng Nam–Đà Nẵng', 'lexeme': 'mô', 'lexical_source': 'https://source.example/article?utm_source=tracking',
            'cell_notes': [{'cell': 'E2', 'note': 'Câu tự biên soạn; chưa duyệt bản địa.'}]}


class CandidateImportTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine('sqlite://')
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.user = User(email='importer@example.com', full_name='Importer', role='admin', account_status='active', password_hash='not-used')
        self.db.add(self.user); self.db.commit()

    def tearDown(self):
        self.db.close(); self.engine.dispose()

    def test_preview_import_shared_source_and_idempotent_retry_keep_all_approvals_pending(self):
        plan = plan_candidates([candidate(), candidate('CS-002', ' Hôm nay.')], SHEET)
        self.assertEqual(import_candidates(self.db, self.user, plan)['new'], 2)
        self.assertEqual(self.db.query(C).count(), 0)
        report = import_candidates(self.db, self.user, plan, apply=True)
        self.db.commit()
        self.assertEqual(report['new'], 2)
        self.assertEqual(self.db.query(S).count(), 1)
        source = self.db.query(S).one()
        self.assertFalse(source.rights_confirmed)
        self.assertNotIn('utm_source', source.evidence)
        for row in self.db.query(C):
            self.assertEqual(row.status, 'RAW')
            self.assertEqual(row.raw['region'], 'Quảng Nam–Đà Nẵng')
            self.assertEqual(row.raw['kind'], 'sentence')
            self.assertFalse(row.raw['consent_train'])
            self.assertFalse(row.raw['consent_public'])
            self.assertEqual(row.source_id, source.id)
            self.assertIn('Câu tự biên soạn', row.raw['source_evidence'])
        self.assertEqual(self.db.query(V).count(), 0)
        self.assertEqual(eligible(self.db), [])
        self.assertEqual(self.db.query(E).filter_by(action='SOURCE_IMPORTED').count(), 2)
        retry = import_candidates(self.db, self.user, plan, apply=True)
        self.db.commit()
        self.assertEqual(retry['already_imported'], 2)
        self.assertEqual(retry['new'], 0)
        self.assertEqual(self.db.query(C).count(), 2)

    def test_conflict_and_invalid_source_fail_before_any_new_write(self):
        original = candidate()
        import_candidates(self.db, self.user, plan_candidates([original], SHEET), apply=True)
        self.db.commit()
        changed = copy.deepcopy(original); changed['target_text'] = 'Bản dịch đã thay đổi'
        plan = plan_candidates([candidate('CS-002'), changed], SHEET)
        with self.assertRaisesRegex(ValueError, 'nội dung thay đổi'):
            import_candidates(self.db, self.user, plan, apply=True)
        self.assertEqual(self.db.query(C).count(), 1)
        self.assertEqual(self.db.query(S).count(), 1)
        for values in ([original, original], [{**original, 'training_eligible': True}], [{**original, 'source_url': 'https://other.example/file'}]):
            with self.assertRaises(ValueError):
                plan_candidates(values, SHEET)

    def test_uncommitted_batch_rolls_back_and_non_admin_cannot_import(self):
        plan = plan_candidates([candidate()], SHEET)
        import_candidates(self.db, self.user, plan, apply=True)
        self.db.rollback()
        self.assertEqual(self.db.query(C).count(), 0)
        self.user.role = 'annotator'; self.db.commit()
        with self.assertRaisesRegex(ValueError, 'quản trị viên'):
            import_candidates(self.db, self.user, plan, apply=True)
