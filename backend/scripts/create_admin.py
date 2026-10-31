"""Create or promote an admin user.

Usage:
    .venv/bin/python -m scripts.create_admin <email> <password> <full_name>

Nếu email đã tồn tại, sẽ promote user đó lên role=admin (giữ nguyên password cũ).
"""
import sys
from datetime import datetime

from app.core.database import SessionLocal, init_db
from app.core.security import hash_password
from app.models import User


def main(email: str, password: str, full_name: str) -> None:
    init_db()
    db = SessionLocal()
    try:
        email = email.strip().lower()
        user = db.query(User).filter(User.email == email).first()
        if user:
            user.role = "admin"
            db.commit()
            print(f"[ok] Promoted existing user '{email}' -> admin")
            return

        user = User(
            email=email,
            full_name=full_name.strip(),
            password_hash=hash_password(password),
            role="admin",
            created_at=datetime.utcnow(),
        )
        db.add(user)
        db.commit()
        print(f"[ok] Created admin '{email}'")
    finally:
        db.close()


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print(__doc__)
        sys.exit(1)
    main(sys.argv[1], sys.argv[2], sys.argv[3])


