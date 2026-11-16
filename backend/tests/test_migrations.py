from pathlib import Path
import sqlite3
from contextlib import closing
import tempfile
import os
import subprocess
import sys
import unittest
from unittest.mock import patch
from alembic import command
from sqlalchemy import create_engine
from scripts.db_migrate import adopt, configuration, upgrade
from scripts.db_sqlite import readonly, snapshot
from app.core.database import verify_migration_head


class MigrationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.db = self.root / 'source.db'
        command.upgrade(configuration(self.db), '0001_baseline')

    def unversion(self):
        with closing(sqlite3.connect(self.db)) as connection, connection:
            connection.execute('DROP TABLE alembic_version')

    def test_adopt_upgrade_restore_preserve_data(self):
        self.unversion()
        with closing(sqlite3.connect(self.db)) as connection, connection:
            connection.execute("INSERT INTO dialect_settings (key,value) VALUES ('migration_probe','{}')")
        target = adopt(self.db, self.root / 'adopted.db')
        backup = snapshot(target, self.root / 'backup.db')
        upgrade(target)
        engine = create_engine('sqlite:///' + target.as_posix())
        try:
            verify_migration_head(engine)
        finally:
            engine.dispose()
        with readonly(target) as connection:
            self.assertEqual(connection.execute("SELECT value FROM dialect_settings WHERE key='migration_probe'").fetchone()[0], '{}')
            self.assertEqual(connection.execute('SELECT version_num FROM alembic_version').fetchone()[0], '0004_server_games')
        restored = snapshot(backup, self.root / 'restored.db')
        with readonly(restored) as connection, readonly(backup) as original:
            self.assertEqual(list(connection.iterdump()), list(original.iterdump()))
        with readonly(self.db) as connection:
            self.assertIsNone(connection.execute("SELECT name FROM sqlite_master WHERE name='alembic_version'").fetchone())

    def test_drift_and_unversioned_upgrade_refused(self):
        self.unversion()
        with closing(sqlite3.connect(self.db)) as connection, connection:
            connection.execute('ALTER TABLE users ADD COLUMN unexpected TEXT')
        output = self.root / 'bad.db'
        with self.assertRaisesRegex(ValueError, 'Schema'):
            adopt(self.db, output)
        self.assertFalse(output.exists())
        with self.assertRaisesRegex(ValueError, 'Unversioned'):
            upgrade(self.db)

    def test_startup_check_is_read_only(self):
        before = self.db.read_bytes()
        engine = create_engine('sqlite:///' + self.db.as_posix())
        try:
            with self.assertRaisesRegex(RuntimeError, 'head mismatch'):
                verify_migration_head(engine)
        finally:
            engine.dispose()
        self.assertEqual(before, self.db.read_bytes())

    def test_wal_backup_and_overwrite_refused(self):
        connection = sqlite3.connect(self.db)
        try:
            connection.execute('PRAGMA journal_mode=WAL')
            connection.execute('CREATE TABLE snapshot_probe (value TEXT)')
            connection.execute("INSERT INTO snapshot_probe VALUES ('committed WAL')")
            connection.commit()
            output = snapshot(self.db, self.root / 'wal.db')
            with readonly(output) as copy:
                self.assertEqual(copy.execute('SELECT value FROM snapshot_probe').fetchone()[0], 'committed WAL')
            with self.assertRaises(FileExistsError):
                snapshot(self.db, output)
            with self.assertRaises(ValueError):
                snapshot(self.db, self.db)
        finally:
            connection.close()

    def test_real_database_copy_adoption(self):
        source = Path(__file__).resolve().parents[1] / 'annotator.db'
        if not source.exists():
            self.skipTest('No local DB')
        copy = snapshot(source, self.root / 'real-copy.db')
        with readonly(copy) as connection:
            counts = {name: connection.execute('SELECT COUNT(*) FROM "' + name + '"').fetchone()[0]
                      for name, in connection.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")}
        adopted = adopt(copy, self.root / 'real-adopted.db')
        upgrade(adopted)
        with readonly(adopted) as connection:
            for name, count in counts.items():
                self.assertEqual(connection.execute('SELECT COUNT(*) FROM "' + name + '"').fetchone()[0], count, name)


    def test_head_matches_current_models(self):
        from app import models
        from app.core.database import Base
        from scripts.db_migrate import schema
        upgrade(self.db)
        model_db = self.root / 'models.db'
        engine = create_engine('sqlite:///' + model_db.as_posix())
        try:
            Base.metadata.create_all(engine)
        finally:
            engine.dispose()
        with readonly(self.db) as migrated, readonly(model_db) as expected:
            self.assertEqual(schema(migrated), schema(expected))

    def test_production_init_checks_only(self):
        from types import SimpleNamespace
        from app.core import database
        engine = create_engine('sqlite:///' + self.db.as_posix())
        try:
            with patch.object(database, 'settings', SimpleNamespace(environment='production', debug=False)), patch.object(database, 'engine', engine), patch.object(database.Base.metadata, 'create_all') as create:
                with self.assertRaisesRegex(RuntimeError, 'head mismatch'):
                    database.init_db()
                create.assert_not_called()
                upgrade(self.db)
                database.init_db()
                create.assert_not_called()
        finally:
            engine.dispose()

    def test_corrupt_backup_refused(self):
        broken = self.root / 'broken.db'
        broken.write_bytes(b'not a sqlite database')
        target = self.root / 'rejected.db'
        with self.assertRaises(sqlite3.DatabaseError):
            snapshot(broken, target)
        self.assertFalse(target.exists())


    def test_adopt_unversioned_full_current_schema(self):
        from app import models
        from app.core.database import Base
        source = self.root / 'development.db'
        engine = create_engine('sqlite:///' + source.as_posix())
        try:
            Base.metadata.create_all(engine)
        finally:
            engine.dispose()
        with closing(sqlite3.connect(source)) as connection, connection:
            connection.execute("INSERT INTO security_throttles VALUES ('preserved', 12, 3)")
        before = source.read_bytes()
        output = adopt(source, self.root / 'current-adopted.db')
        self.assertEqual(source.read_bytes(), before)
        with readonly(output) as connection:
            self.assertEqual(connection.execute('SELECT version_num FROM alembic_version').fetchone()[0], '0004_server_games')
            self.assertEqual(connection.execute('SELECT count FROM security_throttles').fetchone()[0], 3)
        upgrade(output)
        with closing(sqlite3.connect(source)) as connection, connection:
            connection.execute('ALTER TABLE security_throttles ADD COLUMN drift TEXT')
        with self.assertRaisesRegex(ValueError, 'Schema'):
            adopt(source, self.root / 'drift-head.db')

    def test_init_cli_explicit_path_ignores_environment_and_refuses_overwrite(self):
        target = self.root / 'fresh.db'
        decoy = self.root / 'must-not-exist.db'
        env = dict(os.environ, DATABASE_URL='sqlite:///' + decoy.as_posix())
        args = [sys.executable, '-m', 'scripts.db_migrate', 'init', str(target)]
        result = subprocess.run(args, env=env, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse(decoy.exists())
        with readonly(target) as connection:
            self.assertEqual(connection.execute('SELECT version_num FROM alembic_version').fetchone()[0], '0004_server_games')
        before = target.read_bytes()
        result = subprocess.run(args, env=env, capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(before, target.read_bytes())

    def test_init_failure_cleans_new_file(self):
        from scripts.db_migrate import init
        target = self.root / 'failed.db'
        with patch('scripts.db_migrate.command.upgrade', side_effect=RuntimeError('migration failed')):
            with self.assertRaisesRegex(RuntimeError, 'migration failed'):
                init(target)
        self.assertFalse(target.exists())
