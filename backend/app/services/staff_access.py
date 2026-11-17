"""Review is a role; operational access is an explicit, separately revocable grant."""
from fastapi import HTTPException
from app.models.dialect import DialectSetting
from app.models.user import User


def can_operate(db, user):
    if db is None or user.role not in ('reviewer', 'admin'):
        return False
    grant = db.get(DialectSetting, f'operations:{user.id}')
    # Existing administrators keep their designation; ordinary reviewers get none.
    return grant.value is True if grant is not None else user.role == 'admin'


def preserve_operator(db, target):
    if can_operate(db, target) and not any(
        can_operate(db, other) for other in db.query(User).filter(
            User.id != target.id, User.role.in_(('admin', 'reviewer')), User.account_status == 'active').all()
    ):
        raise HTTPException(409, 'Cần giữ ít nhất một Reviewer có quyền vận hành.')


def change_role(db, target, role):
    was_operator = can_operate(db, target)
    if role == 'annotator':
        preserve_operator(db, target)
    target.role = role
    if was_operator or role == 'annotator':
        grant = db.get(DialectSetting, f'operations:{target.id}')
        enabled = was_operator and role == 'reviewer'
        if grant is None:
            db.add(DialectSetting(key=f'operations:{target.id}', value=enabled))
        else:
            grant.value = enabled


def designate_operator(db, user):
    if user.role not in ('admin', 'reviewer'):
        raise ValueError('Only a reviewer can operate')
    grant = db.get(DialectSetting, f'operations:{user.id}')
    if grant is None:
        db.add(DialectSetting(key=f'operations:{user.id}', value=True))
    else:
        grant.value = True
