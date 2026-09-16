"""add commissions and payroll module

Revision ID: 20260915a1b2c3d4e5f7
Revises: 20260914e1f2a3b4c5d6
Create Date: 2026-09-15 00:00:00.000000+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '20260915a1b2c3d4e5f7'
down_revision: Union[str, None] = '20260914e1f2a3b4c5d6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ========================================================================
    # ADVISORS: datos de identidad, banco, sueldo y eliminación lógica
    # ========================================================================
    op.add_column('advisors', sa.Column('document_type', sa.String(length=20), nullable=False, server_default='DNI'))
    op.add_column('advisors', sa.Column('document_number', sa.String(length=30), nullable=False, server_default=''))
    op.add_column('advisors', sa.Column('bank_name', sa.String(length=100), nullable=False, server_default=''))
    op.add_column('advisors', sa.Column('account_number', sa.String(length=60), nullable=False, server_default=''))
    op.add_column('advisors', sa.Column('is_external', sa.Boolean(), nullable=False, server_default=sa.text('false')))
    op.add_column('advisors', sa.Column('base_salary', sa.Numeric(precision=12, scale=2), nullable=True))
    op.add_column('advisors', sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True))

    # ========================================================================
    # TABLA: advisor_commissions (porcentaje de comisión por asesor y proyecto)
    # ========================================================================
    op.create_table(
        'advisor_commissions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('advisor_id', sa.Integer(), nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=False),
        sa.Column('commission_percent', sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('updated_by', sa.Integer(), nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint('commission_percent >= 0 AND commission_percent <= 100', name='ck_commission_percent_range'),
        sa.ForeignKeyConstraint(['advisor_id'], ['advisors.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['updated_by'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('advisor_id', 'project_id', 'deleted_at', name='uq_advisor_commission_pair'),
    )
    op.create_index('ix_advisor_commissions_advisor', 'advisor_commissions', ['advisor_id'])
    op.create_index('ix_advisor_commissions_project', 'advisor_commissions', ['project_id'])

    # ========================================================================
    # TABLA: commission_payments (comisiones de venta y mensualidades de asesores)
    # ========================================================================
    op.create_table(
        'commission_payments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('payment_type', sa.String(length=20), nullable=False),
        sa.Column('advisor_id', sa.Integer(), nullable=True),
        sa.Column('project_id', sa.Integer(), nullable=True),
        sa.Column('contract_id', sa.Integer(), nullable=True),
        sa.Column('contract_number', sa.String(length=50), nullable=True),
        sa.Column('project_name', sa.String(length=200), nullable=True),
        sa.Column('percent_applied', sa.Numeric(precision=5, scale=2), nullable=True),
        sa.Column('base_amount', sa.Numeric(precision=14, scale=2), nullable=True),
        sa.Column('amount', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column('concept', sa.String(length=255), nullable=False, server_default=''),
        sa.Column('payment_period', sa.String(length=10), nullable=True),
        sa.Column('advisor_name', sa.String(length=120), nullable=False),
        sa.Column('document_type', sa.String(length=20), nullable=False, server_default='DNI'),
        sa.Column('document_number', sa.String(length=30), nullable=False, server_default=''),
        sa.Column('bank_name', sa.String(length=100), nullable=False, server_default=''),
        sa.Column('account_number', sa.String(length=60), nullable=False, server_default=''),
        sa.Column('payment_status', sa.String(length=20), nullable=False, server_default='pendiente'),
        sa.Column('payment_date', sa.Date(), nullable=True),
        sa.Column('payment_method', sa.String(length=20), nullable=True),
        sa.Column('transaction_number', sa.String(length=100), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('cancelled_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('cancellation_reason', sa.Text(), nullable=True),
        sa.Column('cancelled_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('updated_by', sa.Integer(), nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint('amount > 0', name='ck_commission_amount_positive'),
        sa.CheckConstraint(
            "payment_status IN ('pendiente', 'pagado', 'anulado')",
            name='ck_commission_status',
        ),
        sa.ForeignKeyConstraint(['advisor_id'], ['advisors.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['contract_id'], ['contracts.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['cancelled_by'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['updated_by'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_commission_payments_type', 'commission_payments', ['payment_type'])
    op.create_index('ix_commission_payments_status', 'commission_payments', ['payment_status'])
    op.create_index('ix_commission_payments_advisor', 'commission_payments', ['advisor_id'])
    op.create_index('ix_commission_payments_project', 'commission_payments', ['project_id'])
    op.create_index('ix_commission_payments_date', 'commission_payments', ['payment_date'])
    op.create_index('ix_commission_payments_deleted', 'commission_payments', ['deleted_at'])


def downgrade() -> None:
    op.drop_index('ix_commission_payments_deleted', table_name='commission_payments')
    op.drop_index('ix_commission_payments_date', table_name='commission_payments')
    op.drop_index('ix_commission_payments_project', table_name='commission_payments')
    op.drop_index('ix_commission_payments_advisor', table_name='commission_payments')
    op.drop_index('ix_commission_payments_status', table_name='commission_payments')
    op.drop_index('ix_commission_payments_type', table_name='commission_payments')
    op.drop_table('commission_payments')

    op.drop_index('ix_advisor_commissions_project', table_name='advisor_commissions')
    op.drop_index('ix_advisor_commissions_advisor', table_name='advisor_commissions')
    op.drop_table('advisor_commissions')

    op.drop_column('advisors', 'deleted_at')
    op.drop_column('advisors', 'base_salary')
    op.drop_column('advisors', 'is_external')
    op.drop_column('advisors', 'account_number')
    op.drop_column('advisors', 'bank_name')
    op.drop_column('advisors', 'document_number')
    op.drop_column('advisors', 'document_type')