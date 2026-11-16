"""SQLite snapshot/restore and validated adoption. All outputs must be new files.

python -m scripts.db_backup SOURCE DESTINATION
python -m scripts.db_restore BACKUP DESTINATION
python -m scripts.db_migrate adopt SOURCE DESTINATION
python -m scripts.db_migrate upgrade DATABASE
"""
from pathlib import Path
import sqlite3
from contextlib import contextmanager, closing


@contextmanager
def readonly(path):
    path = Path(path).resolve(strict=True)
    connection = sqlite3.connect(path.as_uri() + '?mode=ro', uri=True)
    try:
        yield connection
    finally:
        connection.close()


def check_database(connection):
    if connection.execute('PRAGMA integrity_check').fetchall() != [('ok',)]:
        raise ValueError('SQLite integrity check failed')
    if connection.execute('PRAGMA foreign_key_check').fetchone():
        raise ValueError('SQLite foreign key check failed')


def snapshot(source, destination):
    """Online backup API includes committed WAL data; never copies the DB file raw."""
    source = Path(source).resolve(strict=True)
    destination = Path(destination).resolve()
    if source == destination:
        raise ValueError('Source and destination must differ')
    # Exclusive creation prevents accidental replacement of an existing/live DB.
    with destination.open('xb'):
        pass
    try:
        with readonly(source) as src, closing(sqlite3.connect(destination)) as dst:
            src.backup(dst)
            check_database(dst)
    except BaseException:
        destination.unlink(missing_ok=True)
        raise
    return destination
