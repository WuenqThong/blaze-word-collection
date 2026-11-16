"""Operational observations are not a substitute for a scoped, independent pilot."""
from app.models import User
from app.models.dialect import DialectEvent


def assessment(db, active, duplicate_ids, now):
    events = {}
    for event in db.query(DialectEvent).filter(DialectEvent.action.in_(['VERIFIED', 'REJECT', 'BULK_REJECT'])):
        key = (event.contribution_id, event.action.removeprefix('BULK_'))
        events[key] = max(events.get(key, event.created_at), event.created_at)
    completed = [c for c in active if c.status in ('VERIFIED', 'REJECT') and c.id not in duplicate_ids]
    durations = []
    for item in completed:
        end = events.get((item.id, item.status))
        if end is not None and item.created_at <= end <= now:
            durations.append((end - item.created_at).total_seconds() / 3600)
    waiting = [c for c in active if c.status in ('RAW', 'REVIEW', 'HOLD') and c.id not in duplicate_ids]
    late_pending = sum((now - c.created_at).total_seconds() > 48 * 3600 for c in waiting)
    late_completed = sum(hours > 48 for hours in durations)
    reviewers = db.query(User).filter(User.role.in_(('admin', 'reviewer')), User.account_status == 'active').all()
    regions = sorted({c.raw.get('region') or '' for c in active})
    coverage = {region: min((sum(u.id != c.owner_id for u in reviewers) for c in active if (c.raw.get('region') or '') == region), default=0) for region in regions}
    gaps = [{'region': region or 'Chưa ghi vùng', 'reviewers': coverage[region]} for region in regions if coverage[region] < 2]
    return {
        'scope': 'whole_database',
        'review_timing': {
            'completed': len(completed), 'measured': len(durations),
            'missing_history': len(completed) - len(durations),
            'completed_late': late_completed, 'pending_late': late_pending,
            'oldest_waiting_hours': round(max(((now - c.created_at).total_seconds() / 3600 for c in waiting), default=0), 2),
            'max_completed_hours': round(max(durations), 2) if durations else None,
        },
        'reviewer_gaps': gaps,
        'kpis': [
            {'key': 'people', 'status': 'insufficient_evidence', 'reason': 'Chưa xác định nhóm 20 người và thời gian chạy thử; tài khoản quản trị, kiểm thử không được tự tính là người tham gia.'},
            {'key': 'samples', 'status': 'insufficient_evidence', 'reason': 'Số mẫu hiện tại là toàn kho; cần xác định mẫu của đợt chạy thử trước khi so với mốc 1.000.'},
            {'key': 'review_hours', 'status': 'insufficient_evidence', 'reason': 'Đã đo thời gian theo lịch sử kết luận, gồm tồn tạm giữ quá hạn; chưa có đợt chạy thử để nghiệm thu mốc 48 giờ.'},
            {'key': 'noise_rate', 'status': 'insufficient_evidence', 'reason': 'Cần người bản địa đánh giá độc lập mẫu sau chỉnh lý; mẫu bị từ chối hoặc tạm giữ không đồng nghĩa là rác.'},
            {'key': 'duplicate_rate', 'status': 'insufficient_evidence', 'reason': 'Tỷ lệ quan sát chỉ dựa trên mẫu đã đánh dấu trùng trong toàn kho; chưa có kết quả đối chiếu của đợt chạy thử.'},
            {'key': 'disagreement_rate', 'status': 'insufficient_evidence', 'reason': 'Chỉ tính trên mẫu có ít nhất hai phiếu độc lập; cần đủ dữ liệu đúng đợt chạy thử để kết luận.'},
        ],
        'next_release': {
            'status': 'pending',
            'reason': 'Chờ kết quả chạy thử và đánh giá của người bản địa trước khi chốt phạm vi bản tiếp theo.',
        },
    }
