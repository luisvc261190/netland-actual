"""replace announcement button with whatsapp phone

Revision ID: 20260911c2d3e4f5a6b7
Revises: 20260911b1c2d3e4f5a6
Create Date: 2026-09-11 00:00:00.000000+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '20260911c2d3e4f5a6b7'
down_revision: Union[str, None] = '20260911b1c2d3e4f5a6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'site_announcements',
        sa.Column('button_phone', sa.String(length=20), nullable=False, server_default=''),
    )
    op.drop_column('site_announcements', 'button_url')
    op.drop_column('site_announcements', 'button_text')


def downgrade() -> None:
    op.add_column(
        'site_announcements',
        sa.Column('button_text', sa.String(length=60), nullable=False, server_default=''),
    )
    op.add_column(
        'site_announcements',
        sa.Column('button_url', sa.String(length=500), nullable=False, server_default=''),
    )
    op.drop_column('site_announcements', 'button_phone')