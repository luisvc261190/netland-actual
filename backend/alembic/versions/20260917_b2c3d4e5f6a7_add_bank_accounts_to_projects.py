"""add multiple bank accounts to projects

Revision ID: 20260917b2c3d4e5f6a7
Revises: 20260917a1b2c3d4e5f8
Create Date: 2026-09-17 12:00:00.000000+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '20260917b2c3d4e5f6a7'
down_revision: Union[str, None] = '20260917a1b2c3d4e5f8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Cuentas bancarias múltiples del proyecto (JSON lista de dicts).
    # Se usa IF NOT EXISTS porque la columna puede haber sido creada ya por
    # ensure_column_migrations() (vía ALTER TABLE en el arranque de la app).
    op.execute("ALTER TABLE projects ADD COLUMN IF NOT EXISTS bank_accounts JSON NOT NULL DEFAULT '[]'")


def downgrade() -> None:
    op.drop_column('projects', 'bank_accounts')