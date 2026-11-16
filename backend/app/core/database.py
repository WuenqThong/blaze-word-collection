from datetime import datetime, timezone

from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker

from .config import get_settings


def utcnow() -> datetime:
    """Naive UTC datetime — replacement for the deprecated datetime.utcnow()."""
    return datetime.now(timezone.utc).replace(tzinfo=None)

settings = get_settings()

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False, "timeout": 10} if settings.database_url.startswith("sqlite") else {},
)
if engine.dialect.name == 'sqlite':
    @event.listens_for(engine, 'connect')
    def configure_sqlite(connection, _):
        cursor = connection.cursor()
        try:
            cursor.execute('PRAGMA busy_timeout=10000')
            if engine.url.database not in (None, '', ':memory:'):
                cursor.execute('PRAGMA journal_mode=WAL')
        finally:
            cursor.close()
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    from app import models  # noqa: F401  (ensure models are registered)

    if getattr(settings, "environment", "development") == "production":
        verify_migration_head(engine)
    else:
        Base.metadata.create_all(bind=engine)


def verify_migration_head(bind) -> None:
    """Read-only production readiness check; never stamp, migrate or create tables."""
    from pathlib import Path
    from alembic.config import Config
    from alembic.runtime.migration import MigrationContext
    from alembic.script import ScriptDirectory

    root = Path(__file__).resolve().parents[2]
    config = Config(str(root / "alembic.ini"))
    expected = set(ScriptDirectory.from_config(config).get_heads())
    with bind.connect() as connection:
        actual = set(MigrationContext.configure(connection).get_current_heads())
    if actual != expected:
        raise RuntimeError(
            "Database migration head mismatch. Back up and explicitly migrate the database before startup."
        )
