import copy
import json
from pathlib import Path
import unittest
from app.services.contribution_quality import QUALITY_POLICY_VERSION, quality_reasons

class QualityPolicyTests(unittest.TestCase):
    def test_shared_policy(self):
        self.assertEqual(QUALITY_POLICY_VERSION, "contribution-quality-v2")
        self.assertEqual(quality_reasons({'original_text':'mô','meaning':'Có nghĩa là ở đâu; ví dụ: Mi đi mô?','question_kind':'OPEN_WORD','method':'game'}), [])
        cases = json.loads((Path(__file__).resolve().parents[2] / "test-fixtures/contribution-quality-v1.json").read_text(encoding="utf-8"))
        for case in cases:
            with self.subTest(case["name"]):
                raw = copy.deepcopy(case["raw"])
                self.assertEqual(quality_reasons(raw), case["reasons"])
                self.assertEqual(raw, case["raw"])
