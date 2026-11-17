"""Public game allocation policy; preserves source records and past sessions."""
import json
import re
import unicodedata
from pathlib import Path

POLICY = json.loads((Path(__file__).resolve().parents[1] / 'data/player_content_policy.json').read_text(encoding='utf-8'))
EXCLUDED = frozenset(POLICY['excludedRowIds'])
RESTRICTED = frozenset(POLICY['restrictedPhrases'])


def player_question_allowed(question):
    provenance = question.get('provenance') or {}
    if provenance.get('rowId') in EXCLUDED:
        return False
    fields = [question.get('prompt'), question.get('originalText'), question.get('blankTemplate'),
              *question.get('accepted', []), *(option.get('text') for option in question.get('options', [])),
              provenance.get('sense')]
    for field in fields:
        words = re.findall(r'[^\W_]+', unicodedata.normalize('NFC', field or '').lower())
        for start in range(len(words)):
            for length in range(1, min(4, len(words) - start) + 1):
                if ' '.join(words[start:start + length]) in RESTRICTED:
                    return False
    return True
