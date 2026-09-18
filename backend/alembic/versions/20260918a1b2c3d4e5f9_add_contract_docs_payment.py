"""add payment_id to contract_documents

Revision ID: 20260918a1b2c3d4e5f9
Revises: 20260917b2c3d4e5f6a7
Create Date: 2026-09-18 00:00:00.000000+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '20260918a1b2c3d4e5f9'
down_revision: Union[str, None] = '20260917b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ========================================================================
    # DOCUMENTOS DEL CONTRATO: enlace opcional a un pago (boleta/factura de pago)
    # ========================================================================
    # Se usa IF NOT EXISTS porque la columna puede haber sido creada ya por
    # ensure_column_migrations() (vía ALTER TABLE en el arranque de la app).
    op.execute("ALTER TABLE contract_documents ADD COLUMN IF NOT EXISTS payment_id INTEGER NULL")
    op.execute("CREATE INDEX IF NOT EXISTS ix_contract_docs_payment ON contract_documents (payment_id)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_contract_docs_payment")
    op.execute("ALTER TABLE contract_documents DROP COLUMN IF EXISTS payment_id")