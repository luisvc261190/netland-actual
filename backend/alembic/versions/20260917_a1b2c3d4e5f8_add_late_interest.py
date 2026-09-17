"""add late interest columns to payments

Revision ID: 20260917a1b2c3d4e5f8
Revises: 20260915a1b2c3d4e5f7
Create Date: 2026-09-17 00:00:00.000000+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '20260917a1b2c3d4e5f8'
down_revision: Union[str, None] = '20260915a1b2c3d4e5f7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ========================================================================
    # PAGOS: interés por mora calculado al momento del pago
    # ========================================================================
    # Se usa IF NOT EXISTS porque las columnas pueden haber sido creadas ya por
    # ensure_column_migrations() (vía ALTER TABLE en el arranque de la app).
    op.execute("ALTER TABLE payments ADD COLUMN IF NOT EXISTS late_interest_amount NUMERIC(12, 2) NOT NULL DEFAULT 0")
    op.execute("ALTER TABLE payments ADD COLUMN IF NOT EXISTS late_interest_days INTEGER NOT NULL DEFAULT 0")
    op.execute("ALTER TABLE payments ADD COLUMN IF NOT EXISTS late_interest_waived BOOLEAN NOT NULL DEFAULT FALSE")

    # ========================================================================
    # DISTRIBUCIÓN DE PAGOS: días de atraso e interés por cuota
    # ========================================================================
    op.execute("ALTER TABLE payment_allocations ADD COLUMN IF NOT EXISTS late_days INTEGER NOT NULL DEFAULT 0")
    op.execute("ALTER TABLE payment_allocations ADD COLUMN IF NOT EXISTS late_interest NUMERIC(12, 2) NOT NULL DEFAULT 0")


def downgrade() -> None:
    op.execute("ALTER TABLE payment_allocations DROP COLUMN IF EXISTS late_interest")
    op.execute("ALTER TABLE payment_allocations DROP COLUMN IF EXISTS late_days")

    op.execute("ALTER TABLE payments DROP COLUMN IF EXISTS late_interest_waived")
    op.execute("ALTER TABLE payments DROP COLUMN IF EXISTS late_interest_days")
    op.execute("ALTER TABLE payments DROP COLUMN IF EXISTS late_interest_amount")