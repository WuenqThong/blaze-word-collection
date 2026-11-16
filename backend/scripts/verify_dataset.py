"""Verify a downloaded release locally. Never connects to the application DB."""
import argparse
import json
from pathlib import Path
from app.services.dataset_package import verify_package


def main():
    parser = argparse.ArgumentParser(description='Kiểm tra toàn vẹn và chia tập của bản dữ liệu đã xuất.')
    parser.add_argument('dataset', type=Path)
    args = parser.parse_args()
    try:
        result = verify_package(json.loads(args.dataset.read_text(encoding='utf-8-sig')))
    except (ValueError, OSError) as exc:
        parser.exit(1, str(exc) + '\n')
    print(json.dumps(result, ensure_ascii=True, sort_keys=True))
    print('Integrity and frozen splits verified. Rights were checked at export time; current server permission checks still apply. Not an expert-approved benchmark.')


if __name__ == '__main__':
    main()
