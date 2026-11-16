"""Explicit started/submitted acknowledgements for server statistics."""
from alembic import op
import sqlalchemy as sa

revision = '0003_game_receipts'
down_revision = '0002_security'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('dialect_game_receipts',
        sa.Column('session_ref', sa.String(128), sa.ForeignKey('dialect_game_allocations.session_ref'), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('started_at', sa.DateTime(), nullable=False),
        sa.Column('submitted_at', sa.DateTime(), nullable=True),
        sa.Column('withdrawn_at', sa.DateTime(), nullable=True))
    op.create_index('ix_dialect_game_receipts_user_id', 'dialect_game_receipts', ['user_id'])


def downgrade():
    raise RuntimeError('Preserve receipt history; restore a verified backup instead')
