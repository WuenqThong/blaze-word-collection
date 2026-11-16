"""Explicit migration commands. Adoption stamps only a validated output copy."""
import argparse
from pathlib import Path
import tempfile
from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy.engine import URL
from scripts.db_sqlite import check_database, readonly, snapshot

BASELINE = '0001_baseline'
ROOT = Path(__file__).resolve().parents[1]


def configuration(path):
    config = Config(str(ROOT / 'alembic.ini'))
    config.attributes['database_url'] = URL.create('sqlite', database=str(Path(path).resolve()))
    return config


def schema(connection):
    """Compare columns/defaults/PKs, FKs, indexes, checks and triggers strictly."""
    # SQLite rewrites quoting/whitespace; normalize those but retain all constraints.
    def normalize(sql):
        return ''.join(sql.replace('"', '').replace('`', '').replace('[', '').replace(']', '').split()).lower() if sql else None
    return sorted((kind, name, table, normalize(sql)) for kind, name, table, sql in
                  connection.execute("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND name != 'alembic_version'"))


def adopt(source, destination):
    destination = snapshot(source, destination)
    try:
        with readonly(destination) as actual:
            if actual.execute("SELECT 1 FROM sqlite_master WHERE name='alembic_version'").fetchone():
                raise ValueError('Database already versioned; use upgrade')
            with tempfile.TemporaryDirectory() as temporary:
                expected = Path(temporary) / 'reference.db'
                config = configuration(expected)
                head = ScriptDirectory.from_config(config).get_current_head()
                matched = None
                for revision in reversed(list(ScriptDirectory.from_config(config).walk_revisions(base='base', head='heads'))):
                    revision = revision.revision
                    command.upgrade(config, revision)
                    with readonly(expected) as reference:
                        if schema(actual) == schema(reference):
                            matched = revision
                            break
                if matched is None:
                    raise ValueError('Schema does not match a known migration revision; adoption refused')
        command.stamp(configuration(destination), matched)
    except BaseException:
        destination.unlink(missing_ok=True)
        raise
    return destination


def init(destination):
    """Explicitly provision a NEW database at the supplied path to migration head."""
    destination = Path(destination).resolve()
    with destination.open('xb'):
        pass
    try:
        command.upgrade(configuration(destination), 'head')
        with readonly(destination) as connection:
            check_database(connection)
    except BaseException:
        destination.unlink(missing_ok=True)
        raise
    return destination


def upgrade(path):
    path = Path(path).resolve(strict=True)
    with readonly(path) as connection:
        check_database(connection)
        if not connection.execute("SELECT 1 FROM sqlite_master WHERE name='alembic_version'").fetchone():
            raise ValueError('Unversioned DB: adopt into a validated copy first')
    command.upgrade(configuration(path), 'head')
    with readonly(path) as connection:
        check_database(connection)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='action', required=True)
    adoption = sub.add_parser('adopt')
    adoption.add_argument('source')
    adoption.add_argument('destination')
    migration = sub.add_parser('upgrade')
    migration.add_argument('database')
    initialization = sub.add_parser('init')
    initialization.add_argument('destination')
    args = parser.parse_args()
    if args.action == 'adopt':
        print(adopt(args.source, args.destination))
    elif args.action == 'init':
        print(init(args.destination))
    else:
        upgrade(args.database)
        print('Database upgraded to head')


if __name__ == '__main__':
    main()
