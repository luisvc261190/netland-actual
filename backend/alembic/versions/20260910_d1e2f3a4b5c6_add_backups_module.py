"""add backups module

Revision ID: 20260910d1e2f3a4b5
Revises: 20260908a1b2c3d4
Create Date: 2026-09-10 00:00:00.000000+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '20260910d1e2f3a4b5'
down_revision: Union[str, None] = '20260908a1b2c3d4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'backups',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('filename', sa.String(length=255), nullable=False),
        sa.Column('public_id', sa.String(length=255), nullable=False, server_default=''),
        sa.Column('url', sa.String(length=500), nullable=False, server_default=''),
        sa.Column('size_bytes', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('tables_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('total_rows', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='completed'),
        sa.Column('notes', sa.Text(), nullable=False, server_default=''),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index('ix_backups_created_at', 'backups', ['created_at'])


def downgrade() -> None:
    op.drop_index('ix_backups_created_at', table_name='backups')
    op.drop_table('backups')