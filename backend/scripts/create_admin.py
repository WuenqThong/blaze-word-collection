"""Create or designate an operational Reviewer.

Usage:
    .venv/bin/python -m scripts.create_admin <email> <password> <full_name>

Existing accounts keep their password; operational access is explicitly granted.
"""
import sys
from datetime import datetime

from app.core.database import SessionLocal, init_db
from app.core import audit  # noqa: F401
from app.core.security import hash_password
from app.models import User
from app.services.staff_access import designate_operator


def main(email: str, password: str, full_name: str) -> None:
    init_db()
    db = SessionLocal()
    try:
        email = email.strip().lower()
        user = db.query(User).filter(User.email == email).first()
        if user:
            user.role = "reviewer"
            designate_operator(db, user)
            db.commit()
            print(f"[ok] Promoted existing user '{email}' -> reviewer")
            return

        user = User(
            email=email,
            full_name=full_name.strip(),
            password_hash=hash_password(password),
            role="reviewer",
            created_at=datetime.utcnow(),
        )
        db.add(user)
        db.flush()
        designate_operator(db, user)
        db.commit()
        print(f"[ok] Created reviewer '{email}'")
    finally:
        db.close()


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print(__doc__)
        sys.exit(1)
    main(sys.argv[1], sys.argv[2], sys.argv[3])


