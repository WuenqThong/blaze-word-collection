"""Security controls added after the frozen legacy baseline."""
from alembic import op
import sqlalchemy as sa

revision = '0002_security'
down_revision = '0001_baseline'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('security_throttles',
        sa.Column('key', sa.String(64), primary_key=True),
        sa.Column('window', sa.Integer(), nullable=False),
        sa.Column('count', sa.Integer(), nullable=False))
    op.create_table('security_audit_events',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('actor_id', sa.Integer(), nullable=True),
        sa.Column('action', sa.String(64), nullable=False),
        sa.Column('entity_type', sa.String(64), nullable=False),
        sa.Column('entity_id', sa.String(128), nullable=False),
        sa.Column('request_id', sa.String(64), nullable=False),
        sa.Column('details', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False))
    op.create_table('password_recoveries',
        sa.Column('token_hash', sa.String(64), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('issued_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('used_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False))


def downgrade():
    raise RuntimeError('Security history must be preserved; restore a verified backup instead')
