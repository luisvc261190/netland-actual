"""add_contract_pdf_url_to_lots

Revision ID: a1b2c3d4e5f6
Revises: 20260905_202609051a2b3c4d
Create Date: 2026-09-08 00:00:00.000000+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '20260908a1b2c3d4'
down_revision: Union[str, None] = '202609051a2b3c4d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('lots', sa.Column('contract_pdf_url', sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column('lots', 'contract_pdf_url')
