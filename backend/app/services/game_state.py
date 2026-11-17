"""Server-owned catalog and immutable per-play question snapshots."""
from copy import deepcopy
import hashlib
import json
from pathlib import Path
import random
import re
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import func
from app.core.database import utcnow
from app.models.game import GameResource as Resource, GameResourceVersion as Version, GameSession as Play
from app.models.dialect import DialectGameAllocation as Allocation, DialectGameReceipt as Receipt
from app.services.game_original import OPEN_KINDS, question_original
from app.services.player_content import player_question_allowed

CLASSIC = ['GATE', 'GATE', 'GATE', 'LEXEME', 'LEXEME', 'GOLD', 'SENTENCE', 'GOLD', 'OPEN_WORD', 'OPEN_SENTENCE']
SOURCED = ['GATE', 'GATE', 'LEXEME', 'LEXEME', 'LEXEME', 'SENTENCE', 'SENTENCE', 'LEXEME', 'OPEN_WORD', 'OPEN_SENTENCE']
KINDS = {'question', 'exam', 'campaign', 'task', 'taxonomy', 'bank_source'}


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()


def lock(db):
    if db.bind.dialect.name == 'sqlite':
        db.connection().exec_driver_sql('BEGIN IMMEDIATE')


def bootstrap(db):
    exists = bool(db.query(Resource).first())
    if exists and db.query(Resource).filter_by(kind='bank_source').first():
        return
    seed = json.loads((Path(__file__).resolve().parents[1] / 'data/game_catalog.json').read_text(encoding='utf-8'))
    for data in seed['bankSources']:
        db.add(Resource(kind='bank_source', key=data['id'], revision=1, data=data))
        db.add(Version(kind='bank_source', key=data['id'], revision=1, data=data))
    if exists:
        db.commit()
        return
    for kind, plural in [('question', 'questions'), ('exam', 'exams'), ('campaign', 'campaigns'), ('task', 'tasks')]:
        for data in seed[plural]:
            db.add(Resource(kind=kind, key=data['id'], revision=1, data=data))
            db.add(Version(kind=kind, key=data['id'], revision=1, data=data))
    data = {'regions': seed['regions'], 'topics': seed['topics']}
    db.add(Resource(kind='taxonomy', key='default', revision=1, data=data))
    db.add(Version(kind='taxonomy', key='default', revision=1, data=data))
    db.commit()


def catalog(db, admin=False):
    result = {'questions': [], 'exams': [], 'campaigns': [], 'tasks': [], 'regions': [], 'topics': [], 'bankSources': [], 'revisions': {}, 'audio_enabled': False}
    for row in db.query(Resource).order_by(Resource.kind, Resource.key):
        result['revisions'][f'{row.kind}:{row.key}'] = row.revision
        data = deepcopy(row.data)
        if row.kind == 'question' and 'originalText' not in data:
            original = question_original(data)
            if original: data['originalText'] = original
        if row.kind == 'taxonomy':
            result.update(data)
        else:
            if row.kind == 'question' and not admin:
                data['accepted'] = []
                data.pop('correctOptionId', None)
            result[{'question': 'questions', 'exam': 'exams', 'campaign': 'campaigns', 'task': 'tasks', 'bank_source': 'bankSources'}[row.kind]].append(data)
    return result


def question_errors(q):
    if not isinstance(q, dict) or q.get('format') not in (None, 'choice', 'short', 'fill', 'open'):
        return 'Dạng câu hỏi không hợp lệ'
    if q.get('approval') not in ('DRAFT', 'DEMO_APPROVED', 'VERIFIED'):
        return 'Trạng thái duyệt câu hỏi không hợp lệ'
    if not isinstance(q.get('difficulty', 1), int) or not 1 <= q.get('difficulty', 1) <= 3:
        return 'Độ khó câu hỏi không hợp lệ'
    if not isinstance(q.get('accepted', []), list) or len(q.get('accepted', [])) > 100 or any(not isinstance(v, str) or len(v) > 5000 for v in q.get('accepted', [])):
        return 'Đáp án hoặc biến thể không hợp lệ'
    if q.get('kind') not in set(CLASSIC + SOURCED) or not str(q.get('prompt', '')).strip():
        return 'Thiếu nội dung hoặc loại câu hỏi không hợp lệ'
    if 'originalText' in q and (not isinstance(q['originalText'], str) or len(q['originalText']) > 5000):
        return 'Cách nói địa phương gốc không hợp lệ hoặc quá dài'
    if q.get('kind') not in OPEN_KINDS and not question_original(q):
        return 'Bổ sung cách nói địa phương gốc (originalText) rõ ràng cho câu hỏi'
    if q.get('format') == 'choice':
        options = q.get('options', [])
        if not isinstance(options, list) or any(not isinstance(o, dict) for o in options):
            return 'Phương án trả lời không hợp lệ'
        if len(options) != 4 or len({o.get('id') for o in options}) != 4 or len({str(o.get('text', '')).strip().casefold() for o in options}) != 4 or any(not o.get('id') or not str(o.get('text', '')).strip() for o in options) or q.get('correctOptionId') not in {o.get('id') for o in options}:
            return 'Trắc nghiệm cần bốn phương án khác nhau và một đáp án đúng'
    if q.get('format') == 'fill' and q.get('blankTemplate', '').count('___') != 1:
        return 'Câu điền từ cần đúng một chỗ trống'
    if q.get('kind') in ('GATE', 'GOLD') and q.get('format') != 'choice' and not any(str(x).strip() for x in q.get('accepted', [])):
        return 'Câu kiểm tra cần đáp án đã duyệt'
    return ''


def validate_exam(db, e, real=False):
    expected = SOURCED if e.get('layout') == 'sourced2' else CLASSIC
    ids = e.get('questionIds', [])
    if len(ids) != 10 or len(set(ids)) != 10:
        raise HTTPException(422, 'Bộ đề cần đúng mười câu khác nhau')
    for i, (key, kind) in enumerate(zip(ids, expected)):
        row = db.get(Resource, ('question', key))
        q = row.data if row else {}
        if q.get('kind') != kind or q.get('approval') == 'DRAFT' or question_errors(q):
            raise HTTPException(422, f'Câu {i + 1} chưa đủ nội dung, đáp án hoặc duyệt đúng loại')
        if real and (q.get('demo') or q.get('approval') != 'VERIFIED' or q.get('provenance', {}).get('verification') != 'verified'):
            raise HTTPException(422, f'Câu {i + 1} chưa đủ điều kiện thu thập thật')
        if real:
            source = db.get(Resource, ('bank_source', q.get('sourceId', '')))
            if not source or source.data.get('demo') or not source.data.get('train'):
                raise HTTPException(422, f'Nguồn câu {i + 1} chưa đủ quyền thu thập thật')


def save_resource(db, kind, key, value, revision, user):
    if kind not in KINDS or len(key) > 128 or len(json.dumps(value, ensure_ascii=False)) > 100_000:
        raise HTTPException(422, 'Loại cấu hình hoặc kích thước không hợp lệ')
    row = db.get(Resource, (kind, key), with_for_update=True)
    if (row.revision if row else 0) != revision:
        raise HTTPException(409, 'Cấu hình đã được cập nhật ở nơi khác. Tải lại trước khi sửa.')
    data = deepcopy(value)
    for field, length in [('title', 255), ('prompt', 5000), ('region', 255), ('topic', 255)]:
        if field in data and (not isinstance(data[field], str) or len(data[field]) > length):
            raise HTTPException(422, 'Tên, nội dung hoặc vùng không hợp lệ hoặc quá dài')
    provenance = data.get('provenance', {})
    if not isinstance(provenance, dict) or any(not isinstance(v, str) or len(v) > (2048 if k == 'url' else 255) for k, v in provenance.items() if k in ('url', 'rowId', 'sheet', 'sense')):
        raise HTTPException(422, 'Thông tin nguồn câu hỏi không hợp lệ hoặc quá dài')
    if kind != 'taxonomy' and data.get('id') != key:
        raise HTTPException(422, 'Mã cấu hình không khớp')
    if kind == 'question':
        if 'originalText' in data and (not isinstance(data['originalText'], str) or len(data['originalText']) > 5000):
            raise HTTPException(422, 'Cách nói địa phương gốc không hợp lệ hoặc quá dài')
        if 'originalText' not in data:
            original = question_original(data)
            if original: data['originalText'] = original
        error = question_errors(data)
        if error and data.get('approval') != 'DRAFT':
            raise HTTPException(422, error)
        in_use = any(key in e.data.get('questionIds', []) and e.data.get('status') != 'draft' for e in db.query(Resource).filter_by(kind='exam'))
        if row and in_use and digest(row.data) != digest(data):
            raise HTTPException(409, 'Câu hỏi đã được phát hành. Tạo phiên bản mới để thay đổi.')
    elif kind == 'exam':
        if data.get('layout') == 'sourced2' and data.get('mode') != 'strict':
            raise HTTPException(422, 'Bộ dữ liệu số 1 phải bật kiểm tra đầu vào: trả lời đúng hoặc ghi nhận đề xuất từ lần sai thứ 4')
        if row and row.data.get('status') != 'draft' and {k:v for k,v in data.items() if k != 'status'} != {k:v for k,v in row.data.items() if k != 'status'}:
            raise HTTPException(409, 'Bộ đề đã phát hành. Tạo phiên bản mới để thay đổi.')
        if data.get('status') not in ('draft', 'active', 'closed'):
            raise HTTPException(422, 'Trạng thái bộ đề không hợp lệ')
        if data.get('status') == 'active':
            validate_exam(db, data, not data.get('demo', True))
    elif kind == 'campaign':
        if not str(data.get('title', '')).strip() or not data.get('examIds') or any(not db.get(Resource, ('exam', e)) for e in data['examIds']):
            raise HTTPException(422, 'Chiến dịch cần tên và các bộ đề có trên máy chủ')
    elif kind == 'taxonomy':
        if key != 'default' or set(data) != {'regions', 'topics'} or any(not isinstance(values, list) or not values or len(values) > 200 or any(not isinstance(v, str) or not v.strip() or len(v) > 255 for v in values) for values in data.values()):
            raise HTTPException(422, 'Danh mục cần vùng và chủ đề hợp lệ')
    elif kind == 'bank_source':
        if key.startswith('s:') or not str(data.get('title', '')).strip() or not isinstance(data.get('evidence'), str) or not data['evidence'].strip() or len(data['evidence']) > 5000 or any(not isinstance(data.get(flag), bool) for flag in ('train','public','audio','demo')):
            raise HTTPException(422, 'Nguồn ngân hàng câu hỏi cần tên, chứng cứ và phạm vi quyền hợp lệ')
    elif kind == 'task' and (not data.get('title') or not data.get('prompt') or data.get('mediaId')):
        raise HTTPException(422, 'Nhiệm vụ cần tên, nội dung và chỉ dùng văn bản trong pilot')
    next_revision = revision + 1
    if row:
        row.data, row.revision, row.updated_at = data, next_revision, utcnow()
    else:
        row = Resource(kind=kind, key=key, revision=next_revision, data=data)
        db.add(row)
    db.add(Version(kind=kind, key=key, revision=next_revision, data=data, actor_id=user.id))
    db.commit()
    return {'revision': next_revision}


def blank_answer():
    return {'text':'', 'originalText':'', 'meaning':'', 'standard':'', 'context':'', 'skipped':False, 'attempts':[], 'suggestion':'', 'updatedAt':utcnow().isoformat()+'Z'}


def pack_session(row, user):
    from sqlalchemy.orm import object_session
    from app.services.staff_access import can_operate
    data = deepcopy(row.data)
    data.update(deepcopy(row.snapshot))
    for q in data['questions']:
        if 'originalText' not in q:
            original = question_original(q)
            if original: q['originalText'] = original
    data.update({'id':row.session_ref, 'owner':f'account:{row.user_id}', 'serverRevision':row.revision, 'serverAllocated':True, 'serverPending':[], 'recovery':'', 'receipts':{'started':{'done':True}}})
    if data['state'] == 'submitted': data['receipts']['submitted'] = {'done':True}
    if data['state'] == 'withdrawn': data['receipts']['withdraw'] = {'done':True}
    if not can_operate(object_session(row), user):
        for q in data['questions']:
            q['accepted'] = []
            q.pop('correctOptionId', None)
    return data


def start_session(db, body, user):
    existing = db.get(Play, body.session_ref)
    body_hash = digest(body.model_dump())
    if existing:
        if existing.user_id != user.id or existing.start_hash != body_hash:
            raise HTTPException(409, 'Mã lượt đã dùng cho tài khoản hoặc nội dung khác')
        return pack_session(existing, user)
    if user.role not in ('annotator', 'admin', 'reviewer'):
        raise HTTPException(403, 'Vai trò này không tham gia thu thập bằng trò chơi')
    prior = db.query(Play).filter_by(user_id=user.id).all()
    for p in prior:
        if p.data['state'] == 'playing' and p.data.get('campaignId', '') == body.campaign_id:
            return pack_session(p, user)
    pool = [r.data for r in db.query(Resource).filter_by(kind='exam') if r.data.get('status') == 'active']
    campaign = None
    if body.campaign_id:
        campaign = db.get(Resource, ('campaign', body.campaign_id))
        if not campaign or not campaign.data.get('active'):
            raise HTTPException(409, 'Chiến dịch chưa mở hoặc đã đóng')
        pool = [e for e in pool if e['id'] in campaign.data.get('examIds', [])]
    if body.exam_id: pool = [e for e in pool if e['id'] == body.exam_id]
    if not pool: raise HTTPException(409, 'Chưa có bộ đề hợp lệ đang mở')
    finished = {p.snapshot['exam']['id'] for p in prior if p.data['state'] == 'submitted'}
    unplayed = [e for e in pool if e['id'] not in finished]
    plays = dict(db.query(Allocation.exam_id, func.count()).group_by(Allocation.exam_id).all())
    exam = deepcopy(min(unplayed or pool, key=lambda e: (plays.get(e['id'], 0), digest([body.session_ref, e['id']]))))
    validate_exam(db, exam, not exam.get('demo', True))
    questions = [deepcopy(db.get(Resource, ('question', key)).data) for key in exam['questionIds']]
    seen = {q['id'] for p in prior for q in p.snapshot['questions']}
    attempts = [a for p in prior for answer in p.data['answers'] for a in answer.get('attempts', []) if a.get('correct') is not None]
    target = 2 if attempts and sum(a['correct'] is True for a in attempts) / len(attempts) >= .8 else 1
    used = set()
    all_questions = [r.data for r in db.query(Resource).filter_by(kind='question')]
    allowed = {q['id'] for q in all_questions if player_question_allowed(q)}
    for i, original in enumerate(questions):
        if exam.get('adaptive') or (campaign and campaign.data.get('mode') == 'adaptive'):
            candidates = [r.data for r in db.query(Resource).filter_by(kind='question') if r.data.get('kind') == original['kind'] and r.data.get('region') == exam.get('region') and r.data.get('demo') == exam.get('demo') and r.data.get('approval') != 'DRAFT' and r.key not in used and not question_errors(r.data)]
            candidates = [q for q in candidates if q['id'] in allowed]
            if candidates: questions[i] = deepcopy(min(candidates, key=lambda q: (abs(q.get('difficulty',1)-target),q['id'] in seen,digest([body.session_ref,q['id']]))))
        elif exam.get('layout') == 'sourced2' and original['kind'] == 'GATE':
            candidates = [r.data for r in db.query(Resource).filter_by(kind='question') if r.data.get('kind') == 'GATE' and r.data.get('format') == original.get('format') and r.data.get('provenance', {}).get('verification') == 'sourced' and r.data.get('approval') != 'DRAFT' and r.key not in used and not question_errors(r.data)]
            candidates = [q for q in candidates if q['id'] in allowed and q.get('demo') == exam.get('demo')]
            if candidates: questions[i] = deepcopy(min(candidates, key=lambda q: (q['id'] in seen, digest([body.session_ref,q['id']]))))
        if questions[i]['id'] not in allowed or questions[i]['id'] in used:
            candidates = [q for q in all_questions if q['id'] in allowed and q['id'] not in used
                          and all(q.get(field) == original.get(field) for field in ('kind', 'format', 'region', 'demo', 'sourceId'))
                          and q.get('approval') != 'DRAFT' and not question_errors(q)]
            if not candidates:
                raise HTTPException(409, 'Chưa có đủ câu hỏi phù hợp để mở lượt chơi. Vui lòng thử lại sau.')
            questions[i] = deepcopy(min(candidates, key=lambda q: digest([body.session_ref, q['id']])))
        used.add(questions[i]['id'])
        bank_source = db.get(Resource, ('bank_source', questions[i].get('sourceId', '')))
        if bank_source:
            questions[i]['sourceEvidence'] = bank_source.data.get('evidence', '')
            questions[i]['sourceRevision'] = bank_source.revision
        if questions[i].get('options'): random.SystemRandom().shuffle(questions[i]['options'])
    exam['questionIds'] = [q['id'] for q in questions]
    validate_exam(db, exam, not exam.get('demo', True))
    if db.get(Allocation, body.session_ref): raise HTTPException(409, 'Mã lượt cũ chưa có bản đề trên máy chủ; hãy mở lượt mới')
    db.add(Allocation(session_ref=body.session_ref,user_id=user.id,exam_id=exam['id'],campaign_id=body.campaign_id))
    db.flush()
    db.add(Receipt(session_ref=body.session_ref,user_id=user.id,started_at=utcnow()))
    data = {'answers':[blank_answer() for _ in questions], 'cursor':0, 'consent':body.consent, 'region':'', 'upbringing':'', 'usage':'', 'state':'playing', 'createdAt':utcnow().isoformat()+'Z', 'submittedAt':None, 'campaignId':body.campaign_id, 'repeat':exam['id'] in finished}
    regions = deepcopy(db.get(Resource, ('taxonomy','default')).data['regions']) + ['Không chắc']
    row = Play(session_ref=body.session_ref,user_id=user.id,start_hash=body_hash,revision=1,snapshot={'exam':exam,'questions':questions,'allowedRegions':regions},data=data)
    db.add(row); db.commit()
    return pack_session(row,user)


def gate_count(row):
    return 2 if row.snapshot['exam'].get('layout') == 'sourced2' else 3


def can_advance(row, index):
    return row.snapshot['exam'].get('mode') != 'strict' or index < gate_count(row) or all(answered(a) and (a['attempts'][-1].get('correct') is True or gate_proposal(a)) for a in row.data['answers'][:gate_count(row)])


def gate_proposal(answer):
    return bool(not answer.get('skipped') and answered(answer) and answer['attempts'][-1].get('correct') is False and sum(a.get('correct') is False for a in answer['attempts']) > 3)


def answered(answer):
    attempts = answer.get('attempts', [])
    return bool(attempts and (answer.get('skipped') or str(answer.get('text', '')).strip()) and normalize(attempts[-1].get('text', '')) == normalize(answer.get('text', '')) and attempts[-1].get('selectedOptionId', '') == answer.get('selectedOptionId', ''))


def normalize(text):
    from app.routers.dialect import normal
    return re.sub(r'[.!?,;:]+$', '', re.sub(r'\s+', ' ', normal(text)))


def apply_command(db, row, command, user):
    data = deepcopy(row.data)
    action = command.get('type')
    if action == 'withdrawSession':
        from app.routers.dialect_workspace import withdraw_session
        # Withdrawal is also used by the older compatibility endpoint.
        row.data = {**data,'state':'withdrawn'}
        return
    if data['state'] != 'playing': raise HTTPException(409, 'Lượt đã gửi hoặc đã rút; không ghi đè câu trả lời')
    if action in ('answer','draftAnswer'):
        index = command.get('index')
        if not isinstance(index,int) or not 0 <= index < 10 or not can_advance(row,index): raise HTTPException(422,'Câu hỏi chưa mở hoặc vị trí không hợp lệ')
        q = row.snapshot['questions'][index]
        old = data['answers'][index]
        incoming = command.get('answer', {})
        if not isinstance(incoming, dict): raise HTTPException(422, 'Câu trả lời phải có các trường văn bản hợp lệ')
        answer = {k:incoming.get(k,'') for k in ('text','originalText','meaning','standard','context','suggestion','selectedOptionId')}
        if any(not isinstance(v,str) or len(v)>5000 for v in answer.values()): raise HTTPException(422,'Nội dung câu trả lời không hợp lệ hoặc quá dài')
        answer['skipped'] = incoming.get('skipped') is True
        answer['attempts'], answer['updatedAt'] = deepcopy(old['attempts']), utcnow().isoformat()+'Z'
        if action == 'answer':
            if not answer['skipped'] and q.get('format') == 'choice':
                option = next((o for o in q.get('options',[]) if o['id'] == answer['selectedOptionId']), None)
                if not option: raise HTTPException(422,'Hãy chọn một phương án hợp lệ')
                answer['text'] = option['text']
            if not answer['skipped'] and not answer['text'].strip(): raise HTTPException(422,'Nhập câu trả lời hoặc chọn bỏ qua')
            if q['kind'] in OPEN_KINDS and not answer['skipped'] and not answer['originalText'].strip():
                raise HTTPException(422,'Nhập từ hoặc câu địa phương gốc vào ô Cách nói địa phương gốc trước khi xác nhận')
            if index >= 8 and not answer['skipped'] and not (answer['standard'].strip() and (answer['meaning'].strip() or answer['context'].strip())): raise HTTPException(422,'Nhập cách nói phổ thông và giải thích cho câu đóng góp mới')
            correct = None
            if not answer['skipped']:
                if q.get('format') == 'choice': correct = answer['selectedOptionId'] == q.get('correctOptionId')
                elif q['kind'] in ('GATE','GOLD'): correct = any(normalize(answer['text']) == normalize(v) for v in q.get('accepted',[]))
            answer['attempts'].append({'text':answer['text'],'selectedOptionId':answer['selectedOptionId'],'correct':correct,'at':answer['updatedAt']})
            if q['kind'] == 'GATE' and gate_proposal(answer):
                answer['suggestion'] = answer['suggestion'].strip() or answer['text'].strip()
                answer['attempts'][-1]['proposal'] = answer['suggestion']
        data['answers'][index] = answer
        row.data = data
        if action == 'answer':
            target = command.get('next',index)
            if not isinstance(target,int) or not 0 <= target <= 11: raise HTTPException(422,'Bước tiếp theo không hợp lệ')
            data['cursor'] = target if can_advance(row,target) else index
    elif action == 'moveSession':
        target=command.get('cursor')
        if not isinstance(target,int) or not 0 <= target <= 11 or not can_advance(row,target): raise HTTPException(422,'Bước này chưa được mở')
        data['cursor']=target
    elif action in ('sessionMeta','submit'):
        from app.routers.dialect import ProfileInput
        # Same accepted district set as the profile API, with optional drafting values.
        for key in ('region','upbringing','usage'):
            value = command.get(key,'')
            if not isinstance(value,str) or len(value)>255: raise HTTPException(422,'Thông tin vùng không hợp lệ')
            data[key]=value
        regions = row.snapshot.get('allowedRegions') or db.get(Resource, ('taxonomy','default')).data['regions'] + ['Không chắc','Không chắc / nhiều nơi']
        if any(v and v not in regions for v in (data['region'],data['upbringing'],data['usage'])): raise HTTPException(422,'Chọn vùng trong danh sách hoặc Không chắc')
        if action == 'submit':
            if not data['region'] or not data['upbringing'] or not can_advance(row,10) or any(not answered(a) for a in data['answers']): raise HTTPException(422,'Hoàn thành mười câu và thông tin vùng trước khi gửi')
            from app.routers.dialect import ContributionInput, save_contribution
            originals = {}
            for i, (q, a) in enumerate(zip(row.snapshot['questions'], data['answers'])):
                if a.get('skipped'): continue
                if q['kind'] in OPEN_KINDS:
                    original = a.get('originalText', '')
                    if not isinstance(original, str) or not original.strip() or len(original) > 5000:
                        raise HTTPException(422, f'Câu {i+1}: mở lại câu đóng góp và nhập từ hoặc câu địa phương gốc vào ô Cách nói địa phương gốc, rồi xác nhận lại trước khi gửi')
                    if not (a.get('standard', '').strip() and (a.get('meaning', '').strip() or a.get('context', '').strip())):
                        raise HTTPException(422, f'Câu {i+1}: bổ sung cách nói phổ thông và giải thích rồi xác nhận lại trước khi gửi')
                else:
                    original = question_original(q)
                    if not original:
                        raise HTTPException(422, f'Câu {i+1}: bản đề đã lưu thiếu cách nói địa phương gốc rõ ràng. Hãy lưu lại nội dung bản nháp, nhờ người quản lý bổ sung originalText cho câu hỏi và bắt đầu lượt mới; bản đề cũ không thể sửa và bản nháp hiện tại vẫn được giữ nguyên.')
                originals[i] = original.strip()
            for i,(q,a) in enumerate(zip(row.snapshot['questions'],data['answers'])):
                proposal = (a['attempts'][-1].get('proposal') or a.get('suggestion') or a['text']).strip() if q['kind'] == 'GATE' and gate_proposal(a) else ''
                if (a['skipped'] and not proposal) or (q['kind'] in ('GATE','GOLD') and not proposal): continue
                provenance=q.get('provenance',{})
                evidence=f"Đề {row.snapshot['exam']['title']} / Câu {i+1} · {provenance.get('rowId','')} · {provenance.get('url','')} · {q.get('sourceEvidence','')}"[:5000]
                if proposal: evidence = ('Đề xuất đáp án mới sau hơn 3 lần sai; chưa được xác nhận. · ' + evidence)[:5000]
                body=ContributionInput(kind='sentence' if q['kind'] in ('SENTENCE','OPEN_SENTENCE') else 'word',original_text=originals[i],meaning='' if proposal else a['meaning'],standard_vi=proposal or (a['text'] if q.get('format') == 'choice' else a.get('standard') or a['text']),context=q['prompt'] if proposal else a['context'],region=data['region'],source_evidence=evidence,consent_collect=True,consent_train=True,consent_public=bool(data['consent'].get('public')),consent_audio=False,consent_version=data['consent']['version'],method='game',topic=q.get('topic',''),family=f"{row.snapshot['exam']['id']}:q{i+1}",question_kind=q['kind'],question_format=q.get('format',''),session_ref=row.session_ref,idempotency_key=f'{row.session_ref}:q{i+1}')
                saved = save_contribution(body,db,user,commit=False,authoritative_game=True)
                if proposal:
                    from app.models.dialect import DialectContribution
                    from app.routers.dialect import event
                    item = db.get(DialectContribution, saved['id'])
                    item.status = 'HOLD'
                    event(db, item, user, 'ANSWER_PROPOSAL', 'Đề xuất đáp án mới sau hơn 3 lần sai; cần người duyệt kiểm tra, không tính là đáp án đúng')
            data['state'],data['submittedAt']= 'submitted',utcnow().isoformat()+'Z'
            db.get(Receipt,row.session_ref).submitted_at=utcnow()
    else: raise HTTPException(422,'Thao tác lượt chơi không hợp lệ')
    row.data=data
