"""Prepare, call or compare the existing translator; never trains a new model."""
import argparse
import json
from pathlib import Path
from app.services.dataset_package import checksum
from app.services.translation_evaluation import evaluate, prepare, validate_cases


def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))


def write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    # No overwrites: old experiments remain available for comparison.
    with path.open('x', encoding='utf-8') as output:
        json.dump(data, output, ensure_ascii=False, sort_keys=True, indent=2)


def main():
    parser = argparse.ArgumentParser(description='Chuẩn bị và đánh giá dịch phương ngữ sang tiếng Việt phổ thông.')
    commands = parser.add_subparsers(dest='command', required=True)
    export = commands.add_parser('prepare')
    export.add_argument('--dataset', type=Path, required=True)
    export.add_argument('--output', type=Path, required=True)
    export.add_argument('--max-cases', type=int, default=20)
    run = commands.add_parser('run')
    run.add_argument('--cases', type=Path, required=True)
    run.add_argument('--mode', choices=('baseline', 'augmented'), required=True)
    run.add_argument('--output', type=Path, required=True)
    compare = commands.add_parser('compare')
    compare.add_argument('--cases', type=Path, required=True)
    compare.add_argument('--baseline', type=Path, required=True)
    compare.add_argument('--candidate', type=Path, required=True)
    compare.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    try:
        if args.output.exists():
            raise ValueError('Tệp kết quả đã tồn tại; chọn đường dẫn mới để giữ lịch sử.')
        if args.command == 'prepare':
            result = prepare(read(args.dataset), args.max_cases)
        elif args.command == 'run':
            from app.core.config import get_settings
            from app.services.blaze_translation import BlazeTranslation, run_experiment
            settings = get_settings()
            cases = read(args.cases)
            validate_cases(cases)
            authorize = None
            if cases['dataset']['origin'] == 'release':
                from app.core.database import SessionLocal
                from app.services.translation_permissions import validate_live_release
                def authorize():
                    with SessionLocal() as db:
                        validate_live_release(cases, db)
            with BlazeTranslation(settings.blaze_api_token.get_secret_value(), settings.blaze_translation_model) as client:
                result = run_experiment(cases, client, args.mode == 'augmented', lambda n, total: print(f'{n}/{total}', flush=True), authorize=authorize)
        else:
            result = evaluate(read(args.cases), read(args.baseline), read(args.candidate))
        write(args.output, result)
        print(json.dumps({'command': args.command, 'sha256': checksum(result), 'status': result.get('status', 'recorded')}, sort_keys=True))
    except (OSError, ValueError, KeyError, TypeError) as exc:
        parser.exit(1, str(exc) + '\n')


if __name__ == '__main__':
    main()
