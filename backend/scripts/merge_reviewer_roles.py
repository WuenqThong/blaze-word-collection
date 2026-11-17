"""One-time role consolidation; preserves accounts, credentials, votes and ownership."""
import argparse
import json
from pathlib import Path
from sqlalchemy import text
from app.core.database import SessionLocal, engine
from app.models import User
from app.services.staff_access import can_operate, change_role
from app.core import audit  # Register transactional role-change history.


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--actor-id', type=int, required=True)
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--backup', type=Path)
    args = parser.parse_args()
    with SessionLocal() as db:
        if args.apply and engine.dialect.name == 'sqlite':
            db.execute(text('BEGIN IMMEDIATE'))
        actor = db.get(User, args.actor_id)
        if not actor or not can_operate(db, actor) or actor.account_status != 'active':
            parser.error('Cần tài khoản Reviewer đang hoạt động')
        users = db.query(User).filter_by(role='admin').all()
        count = len(users)
        if args.apply and count:
            if engine.dialect.name != 'sqlite' or not args.backup:
                parser.error('Cần đường dẫn backup SQLite mới')
            from scripts.db_sqlite import snapshot
            args.backup.parent.mkdir(parents=True, exist_ok=True)
            snapshot(engine.url.database, args.backup)
            db.info['actor_id'] = actor.id
            for user in users:
                change_role(db, user, 'reviewer')
            db.commit()
        print(json.dumps({'changed': count if args.apply else 0, 'pending': 0 if args.apply else count, 'role': 'reviewer'}))


if __name__ == '__main__':
    main()
