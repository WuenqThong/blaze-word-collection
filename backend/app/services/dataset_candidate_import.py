"""Import reviewed-for-structure source candidates, never approve linguistic data."""
import hashlib
import re
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from app.models.dialect import DialectContribution as C, DialectSource as S
from app.routers.dialect import ContributionInput, digest, event, save_contribution


def source_evidence(value):
    urls = []
    for url in re.findall(r'https?://[^\s]+', value):
        parts = urlsplit(url)
        if parts.username or parts.password:
            raise ValueError('Nguồn không được chứa thông tin đăng nhập')
        query = [(k, v) for k, v in parse_qsl(parts.query) if not k.startswith('utm_')]
        urls.append(urlunsplit((parts.scheme, parts.netloc.lower(), parts.path, urlencode(query), '')))
    if not urls:
        raise ValueError('Ứng viên chưa có URL đối chiếu nguồn')
    return '\n'.join(sorted(set(urls))) + '\nNguồn đối chiếu mục từ; chưa xác nhận tác giả, quyền sử dụng và câu ví dụ.'


def plan_candidates(rows, spreadsheet_id):
    result, keys = [], set()
    for row in rows:
        if row.get('disposition') != 'sentence_pair_candidate_needs_review' or row.get('training_eligible') is not False:
            raise ValueError('Chỉ tiếp nhận ứng viên câu chưa duyệt, chưa đủ quyền huấn luyện')
        if row.get('rights_status') != 'unconfirmed' or row.get('native_review_status') != 'pending':
            raise ValueError('Ứng viên phải giữ trạng thái nguồn/quyền và duyệt bản địa chưa xác nhận')
        url = urlsplit(row['source_url'])
        if url.netloc != 'docs.google.com' or url.path != f'/spreadsheets/d/{spreadsheet_id}/edit':
            raise ValueError('Dòng nguồn không thuộc bảng đã chỉ định')
        key = 'sheet-import:' + hashlib.sha256(f"{spreadsheet_id}:{row['sheet_id']}:{row['original_id']}".encode()).hexdigest()
        if key in keys:
            raise ValueError('Trùng ID ứng viên trong cùng lô; chưa nhập mẫu nào')
        keys.add(key)
        notes = '\n'.join(f"{n['cell']}: {n['note']}" for n in row.get('cell_notes', []))
        evidence = f"Dataset1 · {row['sheet']} · dòng {row['row']} · {row['original_id']}\n{row['source_url']}\nNguồn mục từ: {row['lexical_source']}\nCâu biên soạn để kiểm thử; chưa có xác nhận bản địa, tác giả hoặc quyền huấn luyện.\n{notes}"
        body = ContributionInput(kind='sentence', original_text=row['source_text'], standard_vi=row['target_text'], meaning=row['meaning'],
            context=row['source_text'], region=row['region'], source_evidence=evidence, method='import',
            keywords=row['lexeme'], family='dataset1:' + str(row.get('lexeme_root') or row['lexeme']).strip().casefold(),
            consent_collect=True, consent_train=False, consent_public=False, consent_audio=False, consent_version='demo-import-v1',
            confidence='Chưa duyệt bản địa', idempotency_key=key)
        result.append({'body': body, 'source': source_evidence(row['lexical_source']), 'row_id': row['original_id'], 'source_url': row['source_url']})
    if not result:
        raise ValueError('Không có ứng viên để tiếp nhận')
    return result


def import_candidates(db, user, plan, apply=False):
    if not user or user.role not in ('admin', 'reviewer') or user.account_status != 'active':
        raise ValueError('Cần tài khoản quản trị viên đang hoạt động để tiếp nhận nguồn')
    existing = {}
    # Validate all collisions before changing any rows. The API's idempotency hash is shared.
    for entry in plan:
        body = entry['body']
        old = db.query(C).filter_by(owner_id=user.id, idempotency_key=body.idempotency_key).first()
        payload = body.model_dump(); payload.pop('expected_owner_id', None)
        for key in ('question_kind', 'question_format'):
            if not payload[key]: payload.pop(key)
        if old and old.request_hash != digest(payload):
            raise ValueError(f"Dòng {entry['row_id']} đã nhập nhưng nội dung thay đổi; cần xử lý phiên bản mới")
        if old:
            existing[body.idempotency_key] = old.id
    report = {'candidates': len(plan), 'already_imported': len(existing), 'new': len(plan)-len(existing),
              'applied': apply, 'training_approved': 0, 'source_rights_approved': 0, 'review_votes_added': 0, 'ids': list(existing.values())}
    if not apply:
        return report
    db.info['actor_id'] = user.id
    sources = {}
    for entry in plan:
        body = entry['body']
        if body.idempotency_key in existing:
            continue
        evidence = entry['source']
        if evidence not in sources:
            source = db.query(S).filter_by(owner_id=user.id, evidence=evidence).first()
            if source is None:
                source = S(owner_id=user.id, evidence=evidence, rights_confirmed=False)
                db.add(source); db.flush()
            sources[evidence] = source
        saved = save_contribution(body, db, user, commit=False, imported_source=sources[evidence])
        event(db, db.get(C, saved['id']), user, 'SOURCE_IMPORTED', f"{entry['row_id']} · {entry['source_url']} · Chờ duyệt độc lập và xác nhận quyền; chưa dùng huấn luyện")
        report['ids'].append(saved['id'])
    return report
