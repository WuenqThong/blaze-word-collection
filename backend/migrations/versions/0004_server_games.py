"""Versioned game catalog, authoritative session snapshots and command receipts."""
from alembic import op
import sqlalchemy as sa

revision = '0004_server_games'
down_revision = '0003_game_receipts'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('dialect_game_resources', sa.Column('kind', sa.String(24), primary_key=True), sa.Column('key', sa.String(128), primary_key=True), sa.Column('revision', sa.Integer(), nullable=False), sa.Column('data', sa.JSON(), nullable=False), sa.Column('updated_at', sa.DateTime(), nullable=False))
    op.create_table('dialect_game_resource_versions', sa.Column('kind', sa.String(24), primary_key=True), sa.Column('key', sa.String(128), primary_key=True), sa.Column('revision', sa.Integer(), primary_key=True), sa.Column('data', sa.JSON(), nullable=False), sa.Column('actor_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True), sa.Column('created_at', sa.DateTime(), nullable=False))
    op.create_table('dialect_game_sessions', sa.Column('session_ref', sa.String(128), sa.ForeignKey('dialect_game_allocations.session_ref'), primary_key=True), sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False), sa.Column('start_hash', sa.String(64), nullable=False), sa.Column('revision', sa.Integer(), nullable=False), sa.Column('snapshot', sa.JSON(), nullable=False), sa.Column('data', sa.JSON(), nullable=False), sa.Column('updated_at', sa.DateTime(), nullable=False))
    op.create_index('ix_dialect_game_sessions_user_id', 'dialect_game_sessions', ['user_id'])
    op.create_table('dialect_game_commands', sa.Column('id', sa.Integer(), primary_key=True), sa.Column('session_ref', sa.String(128), sa.ForeignKey('dialect_game_sessions.session_ref'), nullable=False), sa.Column('key', sa.String(128), nullable=False), sa.Column('request_hash', sa.String(64), nullable=False), sa.Column('revision', sa.Integer(), nullable=False), sa.Column('created_at', sa.DateTime(), nullable=False), sa.UniqueConstraint('session_ref', 'key', name='uq_game_command_key'))
    op.create_index('ix_dialect_game_commands_session_ref', 'dialect_game_commands', ['session_ref'])


def downgrade():
    raise RuntimeError('Preserve game history; restore a verified backup instead')
