"""add bank account to projects

Revision ID: 20260914e1f2a3b4c5d6
Revises: 20260911d3e4f5a6b7c8
Create Date: 2026-09-14 00:00:00.000000+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '20260914e1f2a3b4c5d6'
down_revision: Union[str, None] = '20260911d3e4f5a6b7c8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('projects', sa.Column('bank_name', sa.String(length=100), server_default='', nullable=False))
    op.add_column('projects', sa.Column('bank_account_number', sa.String(length=60), server_default='', nullable=False))


def downgrade() -> None:
    op.drop_column('projects', 'bank_account_number')
    op.drop_column('projects', 'bank_name')