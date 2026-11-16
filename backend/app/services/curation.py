"""Validate the human-curated layer without rewriting submitted RAW."""
import unicodedata
from fastapi import HTTPException

CURATED_KEYS = ('text', 'meaning', 'standard', 'context')
FIELDS = ('kind', 'text', 'meaning', 'standard', 'context', 'variants', 'region', 'topic', 'partOfSpeech', 'keywords')
LABELS = {'text': 'Cách nói', 'meaning': 'Nghĩa', 'standard': 'Cách nói phổ thông', 'context': 'Ví dụ / ngữ cảnh'}


def normalize_curated(raw):
    result = {}
    for key in FIELDS:
        value = raw.get(key, '')
        label = LABELS.get(key, 'Trường chuẩn hóa')
        if not isinstance(value, str):
            raise HTTPException(422, f'{label} phải là văn bản')
        if len(value) > 5000:
            raise HTTPException(422, f'{label} không được quá 5.000 ký tự; chưa lưu thay đổi')
        if any(unicodedata.category(c) in ('Cc', 'Cf') and c not in '\t\n\r' for c in value):
            raise HTTPException(422, f'{label} có ký tự ẩn hoặc điều khiển không hợp lệ')
        result[key] = unicodedata.normalize('NFC', value).strip()
    for key in CURATED_KEYS:
        if not result[key]:
            raise HTTPException(422, f'Vui lòng nhập {LABELS[key].lower()} trước khi lưu bản chuẩn hóa')
    return result


def valid_curated(raw):
    if not isinstance(raw, dict):
        return False
    try:
        normalize_curated(raw)
        return True
    except HTTPException:
        return False
