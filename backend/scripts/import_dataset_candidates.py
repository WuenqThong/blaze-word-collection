"""Preview or atomically import source candidates with a mandatory SQLite backup."""
import argparse
import json
from pathlib import Path
from app.core.database import SessionLocal, engine
from app.models import User
from app.services.dataset_candidate_import import import_candidates, plan_candidates


def main():
    parser = argparse.ArgumentParser(description='Tiếp nhận ứng viên từ bảng nguồn; không tự duyệt hoặc cấp quyền sử dụng.')
    parser.add_argument('--input', required=True, type=Path)
    parser.add_argument('--spreadsheet-id', required=True)
    parser.add_argument('--operator-id', required=True, type=int)
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--backup', type=Path)
    args = parser.parse_args()
    try:
        rows = [json.loads(line) for line in args.input.read_text(encoding='utf-8-sig').splitlines() if line.strip()]
        plan = plan_candidates(rows, args.spreadsheet_id)
        with SessionLocal() as db:
            user = db.get(User, args.operator_id)
            report = import_candidates(db, user, plan)
            if args.apply and report['new']:
                if engine.dialect.name != 'sqlite' or not engine.url.database or not args.backup:
                    raise ValueError('Cần bản sao lưu SQLite ở đường dẫn mới trước khi nhập lô')
                from scripts.db_sqlite import snapshot
                snapshot(engine.url.database, args.backup)
                report = import_candidates(db, user, plan, apply=True)
                db.commit()
            print(json.dumps(report, ensure_ascii=True, sort_keys=True))
    except (ValueError, OSError, KeyError) as error:
        parser.exit(1, str(error) + '\n')


if __name__ == '__main__':
    main()
