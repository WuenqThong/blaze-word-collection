from copy import deepcopy
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session
from app.core.database import get_db, utcnow
from app.models.game import GameResource, GameResourceVersion, GameSession, GameCommand
from app.routers.dialect import active, admin, ACCEPTED_CONSENT_VERSIONS
from app.services import game_state as game

router = APIRouter(prefix='/dialect/game', tags=['dialect-game'])


class ResourceInput(BaseModel):
    expected_revision: int = Field(ge=0)
    value: dict[str, Any]


class StartInput(BaseModel):
    session_ref: str = Field(min_length=8, max_length=100)
    exam_id: str = Field(default='', max_length=128)
    campaign_id: str = Field(default='', max_length=128)
    consent: dict

    @field_validator('consent')
    @classmethod
    def check_consent(cls, value):
        if value.get('collect') is not True or value.get('train') is not True or value.get('audio') or value.get('version') not in ACCEPTED_CONSENT_VERSIONS or any(not isinstance(value.get(k, False), bool) for k in ('collect','train','public','audio')):
            raise ValueError('Cần tự đồng ý tiếp nhận và huấn luyện; pilot chưa thu âm thanh')
        return {k: value.get(k, False) for k in ('collect','train','public','audio','version')}


class CommandInput(BaseModel):
    key: str = Field(min_length=8, max_length=128)
    expected_revision: int = Field(ge=1)
    command: dict


@router.get('/catalog')
def get_catalog(db:Session=Depends(get_db), user=Depends(active)):
    game.bootstrap(db)
    result = game.catalog(db,user.role in ('admin', 'reviewer'))
    for kind,plural in [('question','questions'),('exam','exams'),('campaign','campaigns'),('task','tasks'),('bank_source','bankSources')]:
        for item in result[plural]: item['serverRevision']=result['revisions'][f"{kind}:{item['id']}"]
    # Catalog values are already JSON primitives. Avoid FastAPI's recursive
    # encoder walking the entire bank on the event loop for every participant.
    return JSONResponse(result, headers={'Cache-Control': 'no-store'})


@router.put('/catalog/{kind}/{key}')
def put_resource(kind:str,key:str,body:ResourceInput,db:Session=Depends(get_db),user=Depends(admin)):
    game.bootstrap(db)
    game.lock(db)
    value=deepcopy(body.value);value.pop('serverRevision',None)
    return game.save_resource(db,kind,key,value,body.expected_revision,user)


@router.get('/catalog/{kind}/{key}/versions')
def versions(kind:str,key:str,db:Session=Depends(get_db),user=Depends(admin)):
    return [{'revision':v.revision,'created_at':v.created_at,'value':v.data} for v in db.query(GameResourceVersion).filter_by(kind=kind,key=key).order_by(GameResourceVersion.revision.desc()).limit(100)]


@router.post('/sessions')
def start(body:StartInput,db:Session=Depends(get_db),user=Depends(active)):
    game.bootstrap(db)
    game.lock(db)
    return JSONResponse(game.start_session(db,body,user), headers={'Cache-Control': 'no-store'})


@router.get('/sessions')
def sessions(cursor:str=Query(default='',max_length=128),limit:int=Query(default=100,ge=1,le=200),db:Session=Depends(get_db),user=Depends(active)):
    query=db.query(GameSession)
    if user.role not in ('admin', 'reviewer'):query=query.filter_by(user_id=user.id)
    rows=query.filter(GameSession.session_ref>cursor).order_by(GameSession.session_ref).limit(limit+1).all()
    return JSONResponse({'items':[game.pack_session(row,user) for row in rows[:limit]],'next_cursor':rows[limit-1].session_ref if len(rows)>limit else None}, headers={'Cache-Control': 'no-store'})


def owned(db,ref,user):
    row=db.get(GameSession,ref,with_for_update=True)
    if not row or (row.user_id!=user.id and user.role not in ('admin', 'reviewer')):raise HTTPException(404,'Không tìm thấy lượt chơi của tài khoản này')
    return row


@router.get('/sessions/{ref}')
def get_session(ref:str,db:Session=Depends(get_db),user=Depends(active)):
    return JSONResponse(game.pack_session(owned(db,ref,user),user), headers={'Cache-Control': 'no-store'})


@router.post('/sessions/{ref}/commands')
def command(ref:str,body:CommandInput,db:Session=Depends(get_db),user=Depends(active)):
    if len(game.json.dumps(body.command,ensure_ascii=False))>100_000:raise HTTPException(422,'Nội dung yêu cầu quá dài')
    game.lock(db)
    row=owned(db,ref,user)
    if row.user_id!=user.id:raise HTTPException(403,'Quản trị viên chỉ xem, không sửa câu trả lời thay người chơi')
    request_hash=game.digest(body.model_dump())
    previous=db.query(GameCommand).filter_by(session_ref=ref,key=body.key).first()
    if previous:
        if previous.request_hash!=request_hash:raise HTTPException(409,'Mã gửi đã dùng cho nội dung khác')
        return JSONResponse(game.pack_session(row,user), headers={'Cache-Control': 'no-store'})
    if row.revision!=body.expected_revision:
        raise HTTPException(409,{'code':'game_conflict','message':'Lượt chơi đã thay đổi trên thiết bị khác. Chọn cách xử lý trước khi tiếp tục.','session':game.pack_session(row,user)})
    game.apply_command(db,row,body.command,user)
    if body.command.get('type')=='withdrawSession':
        from app.routers.dialect_workspace import withdraw_session_data
        withdraw_session_data(db,ref,user)
    row.revision+=1;row.updated_at=utcnow()
    db.add(GameCommand(session_ref=ref,key=body.key,request_hash=request_hash,revision=row.revision))
    db.commit()
    return JSONResponse(game.pack_session(row,user), headers={'Cache-Control': 'no-store'})
