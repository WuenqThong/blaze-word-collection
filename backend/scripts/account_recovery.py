"""Issue an admin-assisted recovery link after verifying the user's identity.

Usage: python -m scripts.account_recovery --admin EMAIL --user EMAIL
       --base-url https://your-app.example.com --identity-verified
Verify against the company's existing contact channel, not information supplied
only by the requester. Send the resulting link privately through that channel;
never ask for an existing password or OTP. The link expires after 30 minutes.
"""
import argparse
import getpass
from urllib.parse import urlsplit
from app.core.database import SessionLocal
from app.core import audit  # noqa: F401
from app.models import User
from app.schemas.auth import LoginRequest
from app.services.auth_service import AuthService
from app.services.account_recovery import issue_recovery


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--admin', required=True)
    parser.add_argument('--user', required=True)
    parser.add_argument('--base-url', required=True)
    parser.add_argument('--identity-verified', action='store_true', required=True)
    args = parser.parse_args()
    url = urlsplit(args.base_url)
    if url.username or url.password or url.query or url.fragment or url.path not in ('', '/'):
        parser.error('base-url must be an origin without credentials, path, query or fragment')
    if url.scheme != 'https' and not (url.scheme == 'http' and url.hostname in ('localhost', '127.0.0.1')):
        parser.error('HTTPS is required outside localhost')
    with SessionLocal() as db:
        issuer = AuthService(db).authenticate(LoginRequest(email=args.admin, password=getpass.getpass('Admin password: ')))
        target = db.query(User).filter_by(email=args.user.strip().lower()).first()
        if target is None:
            parser.error('User not found')
        token = issue_recovery(db, issuer, target)
        db.commit()
        print(f'{args.base_url.rstrip("/")}/reset-password#token={token}')


if __name__ == '__main__':
    main()
