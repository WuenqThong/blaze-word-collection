"""Portable integrity/leakage checks; stdlib only, never claims current consent."""
import hashlib
import json
import re
import unicodedata
from collections import Counter
from datetime import datetime

SCHEMA = 'dialect-dataset-package-v1'
POLICY = 'dialect-release-connected-v5'


def checksum(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def normalize(value):
    return ' '.join(unicodedata.normalize('NFKC', str(value or '')).casefold().split())


def duplicate_key(raw, curated):
    # Preserve meaningful differences in variants, topic, part of speech and keywords.
    return tuple(normalize(curated.get(k) or (raw.get(k) if k in ('kind', 'region') else '')) for k in (
        'kind', 'text', 'meaning', 'standard', 'context', 'region', 'variants', 'topic', 'partOfSpeech', 'keywords'))


def make_package(version, created_at, records, data_card):
    card = json.loads(data_card)
    result = {'manifest': {
        'schema': SCHEMA, 'version': version,
        'created_at': created_at.isoformat() + 'Z', 'count': len(records),
        'sha256': checksum(records), 'scope': card['scope'],
        'split_policy': card['rule_version'], 'data_card': data_card,
        'warnings': card['warnings'],
    }, 'records': records}
    result['manifest']['package_sha256'] = checksum(result)
    return result


def require(condition):
    if not condition:
        raise ValueError('Dataset validation failed')


def verify_package(package):
    """Reproduce split allocation from frozen universe hashes, without the DB."""
    try:
        manifest, records = package['manifest'], package['records']
        unsigned = {'manifest': {k: v for k, v in manifest.items() if k != 'package_sha256'}, 'records': records}
        require(manifest['schema'] == SCHEMA and manifest['package_sha256'] == checksum(unsigned))
        require(isinstance(manifest['version'], int) and manifest['version'] > 0)
        require(datetime.fromisoformat(manifest['created_at'].replace('Z', '+00:00')).tzinfo is not None)
        require(isinstance(records, list) and records and manifest['count'] == len(records))
        require(manifest['sha256'] == checksum(records))
        card = json.loads(manifest['data_card'])
        require(card['schema'] == 'dialect-data-card-v1')
        require(card['records_sha256'] == manifest['sha256'])
        require(manifest['split_policy'] == card['rule_version'] == POLICY)
        require(manifest['scope'] == card['scope'] == 'verified-training-candidates')
        require(card['benchmark'] is False and card['expert_review'] == {'status': 'pending', 'approved_ids': []})
        require(manifest['warnings'] == card['warnings'])
        groups = card['universe_groups']
        require(isinstance(groups, list) and len(groups) == len(set(groups)))
        require(all(isinstance(g, str) and re.fullmatch('[a-f0-9]{64}', g) for g in groups))
        require(len(groups) == card['counts']['universe_groups'])
        ranked = sorted(groups)
        allocation = dict.fromkeys(ranked, 'train')
        if len(ranked) >= 3:
            holdout = max(1, len(ranked) // 10)
            allocation.update(dict.fromkeys(ranked[:holdout], 'test'))
            allocation.update(dict.fromkeys(ranked[holdout:2 * holdout], 'dev'))
        provenance = {p['id']: p for p in card['provenance']}
        ids = [r['id'] for r in records]
        require(all(type(cid) is int and cid > 0 for cid in ids))
        require(len(ids) == len(set(ids)) == len(card['provenance']))
        require(ids == sorted(ids) and set(ids) == set(provenance))
        require(card['counts']['records'] == len(records))
        require(card['counts']['splits'] == dict(Counter(r['split'] for r in records)))
        require(card['counts']['groups'] == len({p['group'] for p in provenance.values()}))
        require(card['counts']['eligible_universe'] >= len(records))
        seen, duplicates = {}, set()
        for r in records:
            p = provenance[r['id']]
            require(type(p.get('review_revision')) is int and p['review_revision'] >= 1)
            require(isinstance(p.get('review_digest'), str) and re.fullmatch('[a-f0-9]{64}', p['review_digest']))
            require(r['split'] == allocation[p['group']])
            require(r['source_id'] == p['source_id'] and type(r['source_id']) is int)
            require(isinstance(r['raw'], dict) and isinstance(r['curated'], dict))
            require(all(isinstance(r['curated'].get(k), str) and r['curated'][k].strip() for k in ('text', 'meaning', 'standard', 'context')))
            consent, scopes = p['effective_consent'], p['scopes']
            require(consent['collect'] is True and consent['train'] is True and scopes['train'] is True)
            require(consent['version'] in {'dialect-2026-11-v1', 'demo-consent-v1', 'demo-import-v1', 'demo-ai-feedback-v1'})
            require(not scopes['public'] or consent['public'] is True)
            require(not scopes['audio'] or consent['audio'] is True)
            require(all(re.fullmatch('[a-f0-9]{64}', p[k]) for k in ('contributor_ref', 'source_digest', 'group')))
            key = duplicate_key(r['raw'], r['curated'])
            require(key not in duplicates)
            duplicates.add(key)
            keys = [('contributor', p['contributor_ref']), ('source', p['source_id']), ('provenance', p['source_digest'])]
            if r.get('sense_id'):
                keys.append(('sense', normalize(r['sense_id'])))
            for payload in (r['raw'], r['curated']):
                if normalize(payload.get('family')):
                    keys.append(('family', normalize(payload['family'])))
                text = normalize(payload.get('text') or payload.get('original_text'))
                if text:
                    keys.append(('lexeme', text))
                variants = payload.get('variants', '')
                if isinstance(variants, str):
                    variants = re.split(r'[,;|\n]+', variants)
                if isinstance(variants, list):
                    keys.extend(('lexeme', normalize(v)) for v in variants if normalize(v))
            for target in (p.get('parent_id'), p.get('duplicate_of')):
                if target in provenance:
                    require(provenance[target]['group'] == p['group'])
            for key in keys:
                if key in seen:
                    require(seen[key] == p['group'])
                seen[key] = p['group']
        return {'version': manifest['version'], 'records': len(records), 'splits': card['counts']['splits'],
                'package_sha256': manifest['package_sha256'], 'benchmark': False,
                'rights_check': 'at_export_only'}
    except (AssertionError, KeyError, TypeError, ValueError, AttributeError) as exc:
        raise ValueError('Bộ dữ liệu không hợp lệ: mã kiểm tra, cấu trúc, chia tập, trùng hoặc phạm vi sử dụng không khớp.') from exc
