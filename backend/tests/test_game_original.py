import json
from pathlib import Path
import unittest

from app.services.game_original import OPEN_KINDS, question_original


class GameOriginalTests(unittest.TestCase):
    def test_entire_seed_has_structured_sources_matching_legacy_grammar(self):
        catalog = json.loads((Path(__file__).resolve().parents[1] / 'app/data/game_catalog.json').read_text(encoding='utf-8'))
        fixed = [q for q in catalog['questions'] if q['kind'] not in OPEN_KINDS]
        self.assertEqual(len(catalog['questions']), 713)
        self.assertEqual(len(fixed), 611)
        for q in fixed:
            with self.subTest(question=q['id']):
                self.assertTrue(q['originalText'].strip())
                self.assertEqual(question_original({k: v for k, v in q.items() if k != 'originalText'}), q['originalText'])
        for q in catalog['questions']:
            if q['kind'] in OPEN_KINDS:
                self.assertEqual(question_original(q), '')

    def test_word_subject_and_whole_sentence_are_distinct(self):
        cases = [
            ('GATE', 'Trong câu ‘Anh để chiếc xe ở mô?’, ‘mô’ có nghĩa là gì?', 'mô'),
            ('GATE', 'Điền cách nói phổ thông của ‘mô’ trong câu: ‘Anh ở mô?’', 'mô'),
            ('LEXEME', 'Giải thích ‘chi’ trong ‘Tui đã chi hai trăm ngàn tiền xe’. Vì sao không hiểu là từ hỏi ‘gì’?', 'chi'),
            ('LEXEME', 'Nguồn tra cứu chưa kiểm chứng ghi ‘Chộ’ (2) nghĩa là “Chỗ”. Theo bạn, ‘Chộ’ (2) nói theo tiếng phổ thông là gì? Nếu nghĩa khác hoặc bạn chưa nghe từ này, hãy ghi rõ.', 'Chộ'),
            ('SENTENCE', 'Viết lại câu ‘Bà ấy vừa nhắc đến “Cổi” khi kể chuyện.’ bằng tiếng Việt phổ thông.', 'Bà ấy vừa nhắc đến “Cổi” khi kể chuyện.'),
        ]
        for kind, prompt, expected in cases:
            with self.subTest(prompt=prompt):
                self.assertEqual(question_original({'kind': kind, 'prompt': prompt}), expected)

    def test_unrecognized_or_ambiguous_prompts_never_guess(self):
        for prompt in ('So sánh ‘mô’ với ‘tê’.', 'Giải thích ‘mô’ và ‘tê’.', 'Chọn một cách nói.', '“mô”', 'Giải thích ‘mô’ bằng “đâu”.'):
            self.assertEqual(question_original({'kind': 'LEXEME', 'prompt': prompt, 'topic': 'mô', 'provenance': {'sense': 'mô: đâu'}}), '')
        prompt = 'Nguồn tra cứu chưa kiểm chứng ghi ‘mô’ nghĩa là “đâu”. Theo bạn, ‘tê’ nói theo tiếng phổ thông là gì? Nếu nghĩa khác hoặc bạn chưa nghe từ này, hãy ghi rõ.'
        self.assertEqual(question_original({'kind': 'LEXEME', 'prompt': prompt}), '')

    def test_structured_source_is_authoritative_even_when_invalid(self):
        q = {'kind': 'LEXEME', 'prompt': 'Giải thích “chừ” trong một ngữ cảnh cụ thể.'}
        self.assertEqual(question_original({**q, 'originalText': '  tê  '}), 'tê')
        for value in ('', ' ', None, 1, 'x' * 5001):
            self.assertEqual(question_original({**q, 'originalText': value}), '')
        self.assertEqual(question_original({**q, 'kind': 'OPEN_WORD', 'originalText': 'tê'}), '')
