"""Read-only operational evidence; KPI approval and expert review remain explicit."""
from collections import Counter, defaultdict
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db, utcnow
from app.routers.dialect import admin, release_plan
from app.models.dialect import DialectContribution as C, DialectVote as V, DialectContributionMeta as M, DialectGameReceipt as Receipt
from app.models.game import GameResource
from app.models import User
from app.services.runtime_metrics import snapshot
from app.services.pilot_assessment import assessment

router = APIRouter(prefix='/dialect/operations', tags=['pilot-operations'])


@router.get('/summary')
def summary(db: Session = Depends(get_db), user=Depends(admin)):
    active = db.query(C).filter(C.withdrawn_at.is_(None)).all()
    statuses = Counter(c.status for c in active)
    votes = defaultdict(set)
    vote_counts = Counter()
    for cid, verdict in db.query(V.contribution_id, V.verdict):
        votes[cid].add(verdict)
        vote_counts[cid] += 1
    disagreements = {cid for cid, values in votes.items() if len(values) > 1}
    duplicate_ids = {cid for (cid,) in db.query(M.contribution_id).filter(M.duplicate_of.is_not(None))}
    pending = [c for c in active if c.status in ('RAW','REVIEW') and c.id not in duplicate_ids]
    allowed = release_plan(db)['records']
    regions = Counter(c.raw.get('region') or 'Chưa ghi vùng' for c in active)
    bank = [r.data for r in db.query(GameResource).filter_by(kind='question') if r.data.get('kind') in ('GATE','GOLD')]
    evaluation = assessment(db, active, duplicate_ids, utcnow())
    return {
        'generated_at': utcnow(), 'database_engine': db.get_bind().dialect.name,
        'pilot_people': 20, 'targets_status': 'approved',
        'active_reviewers': db.query(User).filter(User.role.in_(('admin', 'reviewer')), User.account_status == 'active').count(),
        'targets': {'samples': 1000, 'review_hours': 48, 'noise_rate': .10, 'duplicate_rate': .10, 'disagreement_rate': .20},
        'pilot_evaluation': {'status': 'not_started', 'cohort_started_at': None, 'expansion_decision': 'pending',
                             'reason': 'Chưa có mốc bắt đầu/nhóm người tham gia và đánh giá độc lập của đợt pilot; số liệu dưới đây là toàn bộ kho hiện tại.'},
        'observed_duplicate_rate': sum(c.id in duplicate_ids for c in active)/len(active) if active else None,
        'reviewed_with_two_votes': sum(vote_counts[c.id] >= 2 for c in active),
        'observed_disagreement_rate': sum(c.id in disagreements for c in active)/sum(vote_counts[c.id] >= 2 for c in active) if any(vote_counts[c.id] >= 2 for c in active) else None,
        'overdue_pending': evaluation['review_timing']['pending_late'],
        'started': db.query(Receipt).count(), 'submitted': db.query(Receipt).filter(Receipt.submitted_at.is_not(None)).count(),
        'samples': len(active), 'pending_review': len(pending), 'held': statuses['HOLD'],
        'rejected': statuses['REJECT'], 'duplicates': sum(c.id in duplicate_ids for c in active),
        'disagreements': sum(c.id in disagreements for c in active),
        'unresolved_disagreements': sum(c.id in disagreements and c.status not in ('VERIFIED','REJECT') for c in active),
        'oldest_pending_hours': evaluation['review_timing']['oldest_waiting_hours'],
        'eligible_release': len(allowed), 'by_region': dict(sorted(regions.items())),
        'reference_questions': len(bank),
        'verified_reference_questions': sum(q.get('approval') == 'VERIFIED' and q.get('provenance',{}).get('verification') == 'verified' for q in bank),
        'independent_quality_assessment': 'not_recorded',
        'assessment': evaluation,
        'pending_sync': None,
        'definitions': {
            'pending_sync': 'Máy chủ không biết số nháp chưa gửi trên thiết bị khác; không báo bằng 0.',
            'disagreements': 'Mẫu còn hiệu lực có ít nhất hai kết luận khác nhau; gồm cả mẫu đã phân xử.',
            'noise': 'Chưa có đánh giá độc lập để phân biệt mẫu rác với mẫu cần bổ sung.',
            'targets': 'Mục tiêu 1.000 mẫu đã tiếp nhận, chưa rút; không đồng nghĩa 1.000 mẫu đủ điều kiện xuất. Tỷ lệ trùng = số mẫu đánh dấu trùng / mẫu chưa rút. Bất đồng = mẫu có kết luận khác nhau / mẫu có ít nhất hai phiếu. Thời gian duyệt tính từ tiếp nhận tới kết luận, mẫu đang chờ quá 48 giờ là trễ hạn.',
            'expert': 'Trạng thái câu hỏi trong hệ thống không thay thế biên bản duyệt độc lập của người bản địa/chuyên gia.',
            'review_timing': 'Thời gian từ tiếp nhận tới sự kiện kết luận đạt/không đạt cuối cùng ứng với trạng thái hiện tại. Thiếu lịch sử thì chưa thể đo. Mẫu tạm giữ vẫn tính vào tồn quá 48 giờ; loại mẫu đã rút hoặc đánh dấu trùng.',
            'http': 'Cửa sổ tối đa 10.000 yêu cầu/1 giờ của tiến trình hiện tại; đặt lại khi khởi động.'},
        'http': snapshot(),
    }
