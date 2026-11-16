"""Seed synthetic QA users/data only in the explicitly isolated QA database."""
import json
import os
from pathlib import Path
import secrets


def main():
    root = Path(os.environ['BLAZE_QA_ROOT']).resolve()
    database = root / 'qa.db'
    expected = 'sqlite:///' + database.as_posix()
    if os.environ.get('DATABASE_URL') != expected:
        raise RuntimeError('QA seeding refused: DATABASE_URL must point to BLAZE_QA_ROOT/qa.db')
    repository = Path(__file__).resolve().parents[2]
    if root == repository or repository in root.parents:
        raise RuntimeError('QA data must be outside the source repository')
    root.mkdir(parents=True, exist_ok=True)

    from fastapi.testclient import TestClient
    from app.main import app
    from app.core.database import SessionLocal, init_db
    from app.core.security import hash_password
    from app.models import User
    from app.models.dialect import DialectContribution
    from app.models.dialect import DialectParticipant

    credentials_path = root / 'accounts.json'
    accounts = json.loads(credentials_path.read_text(encoding='utf-8')) if credentials_path.exists() else []
    if not accounts:
        for name, role in [('contributor-a', 'annotator'), ('contributor-b', 'annotator'),
                           ('reviewer-a', 'reviewer'), ('reviewer-b', 'reviewer'), ('admin', 'admin')]:
            accounts.append(dict(email=f'{name}@qa.example.com', role=role,
                                 full_name=f'QA {name}', password=secrets.token_urlsafe(18)))
        credentials_path.write_text(json.dumps(accounts, indent=2), encoding='utf-8')
    init_db()
    with SessionLocal() as db:
        for account in accounts:
            user = db.query(User).filter_by(email=account['email']).first()
            if user is None:
                db.add(User(email=account['email'], role=account['role'],
                            full_name=account['full_name'], account_status='active',
                            password_hash=hash_password(account['password'])))
        db.commit()
        for account in accounts:
            if account['role'] == 'reviewer':
                user = db.query(User).filter_by(email=account['email']).one()
                if db.get(DialectParticipant, user.id) is None:
                    db.add(DialectParticipant(user_id=user.id, review_region='TP. Hội An'))
        db.commit()

    with TestClient(app) as client:
        for index, account in enumerate(accounts[:2]):
            # Preserve existing QA samples and their consent; do not rewrite history.
            with SessionLocal() as db:
                owner = db.query(User).filter_by(email=account['email']).one()
                if db.query(DialectContribution).filter_by(owner_id=owner.id, idempotency_key=f'isolated-qa-sample-{index}').first():
                    continue
            response = client.post('/api/auth/login', json={k: account[k] for k in ('email', 'password')})
            response.raise_for_status()
            response = client.post('/api/dialect/contributions', json=dict(
                kind='word', original_text=['mô', 'răng'][index], meaning=['đâu', 'sao'][index],
                standard_vi=['đâu', 'sao'][index], region='Hội An',
                context='Dữ liệu tổng hợp QA, không phải khảo sát người dùng.',
                source_evidence='Fixture QA tổng hợp, không dùng huấn luyện hoặc công bố.',
                consent_collect=True, consent_train=True, consent_public=False, consent_audio=False,
                consent_version='demo-consent-v1', idempotency_key=f'isolated-qa-sample-{index}'))
            response.raise_for_status()
            client.post('/api/auth/logout').raise_for_status()
    print(f'QA ready: 5 accounts, 2 synthetic samples. Credentials: {credentials_path}')


if __name__ == '__main__':
    main()
