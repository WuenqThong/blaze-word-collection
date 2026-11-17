"""Add immutable review archives without rewriting existing content or ballots."""
from alembic import op
import sqlalchemy as sa

revision = '0005_review_archives'
down_revision = '0004_server_games'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('dialect_review_archives',
        sa.Column('contribution_id', sa.Integer(), sa.ForeignKey('dialect_contributions.id'), primary_key=True),
        sa.Column('revision', sa.Integer(), primary_key=True),
        sa.Column('digest', sa.String(64), nullable=False),
        sa.Column('content', sa.JSON(), nullable=False),
        sa.Column('votes', sa.JSON(), nullable=False),
        sa.Column('status', sa.String(16), nullable=False),
        sa.Column('actor_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False))


def downgrade():
    raise RuntimeError('Preserve review history; restore a verified backup instead')
