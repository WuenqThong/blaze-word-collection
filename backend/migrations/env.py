"""Run explicit migrations; the application never runs these in production."""
import os
from alembic import context
from sqlalchemy import create_engine, pool

config = context.config

def run(connection):
    context.configure(connection=connection, target_metadata=None, render_as_batch=True)
    with context.begin_transaction():
        context.run_migrations()

if context.is_offline_mode():
    raise RuntimeError("Use online migrations against a backed-up SQLite database")
provided = config.attributes.get("connection")
if provided is not None:
    run(provided)
else:
    url = config.attributes.get("database_url") or os.environ.get("DATABASE_URL") or config.get_main_option("sqlalchemy.url")
    engine = create_engine(url, poolclass=pool.NullPool)
    try:
        with engine.connect() as connection:
            run(connection)
    finally:
        engine.dispose()
