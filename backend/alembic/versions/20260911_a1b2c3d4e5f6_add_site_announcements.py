"""add site announcements

Revision ID: 20260911a1b2c3d4e5f6
Revises: 20260910d1e2f3a4b5
Create Date: 2026-09-11 00:00:00.000000+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '20260911a1b2c3d4e5f6'
down_revision: Union[str, None] = '20260910d1e2f3a4b5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'site_announcements',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=False, server_default=''),
        sa.Column('image_url', sa.String(length=500), nullable=False, server_default=''),
        sa.Column('button_text', sa.String(length=60), nullable=False, server_default=''),
        sa.Column('button_url', sa.String(length=500), nullable=False, server_default=''),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('once_per_session', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('start_date', sa.Date(), nullable=True),
        sa.Column('end_date', sa.Date(), nullable=True),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_site_announcements_is_active', 'site_announcements', ['is_active'])


def downgrade() -> None:
    op.drop_index('ix_site_announcements_is_active', table_name='site_announcements')
    op.drop_table('site_announcements')