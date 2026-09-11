"""add kind and media_type to announcements

Revision ID: 20260911b1c2d3e4f5a6
Revises: 20260911a1b2c3d4e5f6
Create Date: 2026-09-11 00:00:00.000000+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '20260911b1c2d3e4f5a6'
down_revision: Union[str, None] = '20260911a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'site_announcements',
        sa.Column('kind', sa.String(length=20), nullable=False, server_default='announcement'),
    )
    op.add_column(
        'site_announcements',
        sa.Column('media_type', sa.String(length=10), nullable=False, server_default='image'),
    )


def downgrade() -> None:
    op.drop_column('site_announcements', 'media_type')
    op.drop_column('site_announcements', 'kind')