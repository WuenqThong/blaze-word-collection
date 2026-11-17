"""Package current Git-visible sources, including uncommitted work, without local data."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import subprocess
import zipfile


ROOT = Path(__file__).resolve().parents[1]


def include(name):
    path = Path(name)
    if any('claude' in part.casefold() for part in path.parts):
        return False
    if path.as_posix() == '.vscode/settings.json':
        return False
    if any(part in {'.git', '.venv', 'node_modules', '__pycache__', 'dist',
                    '.claude', 'designs', 'backups', 'releases'} for part in path.parts):
        return False
    if any(part.startswith('.env') and not part.endswith('.example') for part in path.parts):
        return False
    return not (path.suffix.lower() in {'.db', '.sqlite', '.sqlite3', '.pyc', '.log', '.zip', '.wav'}
                or path.name.endswith(('.db-wal', '.db-shm', '.sqlite-wal', '.sqlite-shm')))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-dir', type=Path, default=ROOT.parent / 'blaze-releases')
    args = parser.parse_args()
    output = args.output_dir.resolve()
    if output == ROOT or ROOT in output.parents:
        parser.error('Keep release archives outside the source workspace')
    output.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    archive = output / f'blaze-word-collection-{stamp}.zip'
    names = subprocess.check_output(
        ['git', 'ls-files', '-co', '--exclude-standard', '-z'], cwd=ROOT,
    ).decode('utf-8').split('\0')
    manifest = {}
    with zipfile.ZipFile(archive, 'x', zipfile.ZIP_DEFLATED) as bundle:
        for name in sorted(set(names)):
            source = ROOT / name
            if not name or not include(name) or not source.is_file():
                continue
            if source.is_symlink() or not source.resolve().is_relative_to(ROOT):
                raise ValueError(f'Unsafe source path: {name}')
            data = source.read_bytes()
            manifest[name] = hashlib.sha256(data).hexdigest()
            bundle.writestr('blaze-word-collection/' + name, data)
        bundle.writestr('blaze-word-collection/RELEASE-MANIFEST.json', json.dumps({
            'created_utc': stamp, 'files': manifest,
            'database_included': False,
            'note': 'Current workspace sources; Docker image must be built on the target host.',
        }, ensure_ascii=False, indent=2))
    with zipfile.ZipFile(archive) as bundle:
        if bundle.testzip() is not None:
            raise ValueError('Archive integrity check failed')
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    archive.with_suffix('.zip.sha256').write_text(f'{digest}  {archive.name}\n', encoding='ascii')
    print(f'{archive}\nFiles: {len(manifest)}\nSHA256: {digest}')


if __name__ == '__main__':
    main()
