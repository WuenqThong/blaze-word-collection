"""Version-bound review, with current-only ballots and immutable old epochs."""
from copy import deepcopy
import hashlib
import json
import unicodedata

from fastapi import HTTPException
from sqlalchemy import func

from app.models.dialect import DialectContributionMeta as M, DialectVote as V, DialectReviewArchive as A
from app.services.curation import FIELDS


def normalized(value):
    return ' '.join(unicodedata.normalize('NFC', value or '').split())


def content_of(item, meta=None):
    raw = item.raw
    if meta is not None and meta.curated is not None:
        fields = meta.curated
    else:
        fields = {**raw, 'text': raw.get('original_text', ''),
                  'standard': raw.get('standard_vi', ''), 'partOfSpeech': raw.get('part_of_speech', '')}
    return {'fields': {key: normalized(fields.get(key, '')) for key in FIELDS},
            'sense_id': normalized(meta.sense_id if meta and meta.sense_id else str(item.id)),
            'qa_audio': (meta.qa_audio or '') if meta else ''}


def review_state(db, item):
    revision = (db.query(func.max(A.revision)).filter_by(contribution_id=item.id).scalar() or 0) + 1
    content = content_of(item, db.get(M, item.id))
    payload = {'revision': revision, 'contribution_id': item.id, 'raw': item.raw, 'content': content}
    digest = hashlib.sha256(json.dumps(payload, ensure_ascii=False, sort_keys=True,
                                      separators=(',', ':')).encode()).hexdigest()
    return digest, revision


def require_digest(db, item, expected):
    state = review_state(db, item)
    if not expected or expected != state[0]:
        raise HTTPException(409, 'Nội dung hoặc vòng duyệt đã đổi; hãy tải lại trước khi thao tác')
    return state


def binding(db, item):
    digest, revision = review_state(db, item)
    return {'review_digest': digest, 'review_revision': revision}


def bound_votes(db, item):
    """Legacy RAW-only ballots are safe; legacy CURATED ballots are unproven."""
    expected = binding(db, item)
    meta = db.get(M, item.id)
    legacy_raw = expected['review_revision'] == 1 and (not meta or meta.curated is None)
    votes = db.query(V).filter_by(contribution_id=item.id).all()
    return [v for v in votes if v.reviewer_id != item.owner_id and (
        all(v.rubric.get(k) == value for k, value in expected.items()) or
        (legacy_raw and not any(k in v.rubric for k in expected)))]


def vote_snapshot(vote):
    return {'id': vote.id, 'reviewer_id': vote.reviewer_id, 'verdict': vote.verdict,
            'rubric': deepcopy(vote.rubric), 'note': vote.note,
            'created_at': vote.created_at.isoformat()}


def archive_current(db, item, actor):
    digest, revision = review_state(db, item)
    meta = db.get(M, item.id)
    votes = db.query(V).filter_by(contribution_id=item.id).all()
    db.add(A(contribution_id=item.id, revision=revision, digest=digest,
             content=deepcopy({'raw': item.raw, 'curated': meta.curated if meta else None,
                               **content_of(item, meta)}),
             votes=[vote_snapshot(v) for v in votes], status=item.status, actor_id=actor.id))
    # Flush the complete history BEFORE deleting any current ballot, in the same transaction.
    db.flush()
    for vote in votes:
        db.delete(vote)
    db.flush()
    item.status = 'RAW'


def history(db, item):
    return [{'review_revision': a.revision, 'review_digest': a.digest,
             'content': deepcopy(a.content), 'status': a.status, 'votes': deepcopy(a.votes),
             'actor_id': a.actor_id, 'created_at': a.created_at}
            for a in db.query(A).filter_by(contribution_id=item.id).order_by(A.revision)]
