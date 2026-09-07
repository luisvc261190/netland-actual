"""add sale pricing fields to contracts

Revision ID: 202609051a2b3c4d
Revises: a1b2c3d4e5f6
Create Date: 2026-09-05 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '202609051a2b3c4d'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade():
    # Recargos por ubicación (mismos criterios que las cotizaciones)
    op.add_column(
        'contracts',
        sa.Column('esquina_surcharge', sa.Numeric(precision=12, scale=2), nullable=True, server_default='0.00'),
    )
    op.add_column(
        'contracts',
        sa.Column('frente_parque_surcharge', sa.Numeric(precision=12, scale=2), nullable=True, server_default='0.00'),
    )
    op.add_column(
        'contracts',
        sa.Column('frente_a_pista_surcharge', sa.Numeric(precision=12, scale=2), nullable=True, server_default='0.00'),
    )
    # Descuento: none | percentage | fixed
    op.add_column(
        'contracts',
        sa.Column('discount_type', sa.String(length=20), nullable=True, server_default='none'),
    )
    op.add_column(
        'contracts',
        sa.Column('discount_value', sa.Numeric(precision=12, scale=2), nullable=True, server_default='0.00'),
    )


def downgrade():
    op.drop_column('contracts', 'discount_value')
    op.drop_column('contracts', 'discount_type')
    op.drop_column('contracts', 'frente_a_pista_surcharge')
    op.drop_column('contracts', 'frente_parque_surcharge')
    op.drop_column('contracts', 'esquina_surcharge')