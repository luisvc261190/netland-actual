"""drop promotions module

Revision ID: 20260911d3e4f5a6b7c8
Revises: 20260911c2d3e4f5a6b7
Create Date: 2026-09-11 00:00:00.000000+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '20260911d3e4f5a6b7c8'
down_revision: Union[str, None] = '20260911c2d3e4f5a6b7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_table('promotions')


def downgrade() -> None:
    op.create_table(
        'promotions',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column(
            'project_id',
            sa.Integer(),
            sa.ForeignKey('projects.id', ondelete='CASCADE'),
            nullable=False,
        ),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=False, server_default=''),
        sa.Column('old_price', sa.Numeric(12, 2), nullable=True),
        sa.Column('promo_price', sa.Numeric(12, 2), nullable=True),
        sa.Column('start_date', sa.Date(), nullable=True),
        sa.Column('end_date', sa.Date(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text('now()'),
        ),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
    )