"""create owners and collections module

Revision ID: a1b2c3d4e5f6
Revises: 6f4d2a1b9c7e
Create Date: 2026-09-04 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = '6f4d2a1b9c7e'
branch_labels = None
depends_on = None


def upgrade():
    # ========================================================================
    # TABLA: owners
    # ========================================================================
    op.create_table(
        'owners',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('client_id', sa.Integer(), nullable=False),
        sa.Column('person_type', sa.String(length=20), nullable=False, server_default='natural'),
        sa.Column('document_type', sa.String(length=20), nullable=False, server_default='DNI'),
        sa.Column('document_number', sa.String(length=20), nullable=False),
        sa.Column('first_name', sa.String(length=120), nullable=True),
        sa.Column('paternal_surname', sa.String(length=120), nullable=True),
        sa.Column('maternal_surname', sa.String(length=120), nullable=True),
        sa.Column('business_name', sa.String(length=255), nullable=True),
        sa.Column('secondary_phone', sa.String(length=30), nullable=True),
        sa.Column('address', sa.String(length=255), nullable=True),
        sa.Column('district', sa.String(length=100), nullable=True),
        sa.Column('province', sa.String(length=100), nullable=True),
        sa.Column('department', sa.String(length=100), nullable=True),
        sa.Column('birth_date', sa.Date(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('updated_by', sa.Integer(), nullable=True),
        sa.CheckConstraint(
            "(person_type = 'natural' AND first_name IS NOT NULL) OR (person_type = 'juridica' AND business_name IS NOT NULL)",
            name='ck_owner_person_data'
        ),
        sa.ForeignKeyConstraint(['client_id'], ['clients.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['updated_by'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('client_id', name='uq_owners_client_id'),
        sa.UniqueConstraint('document_type', 'document_number', name='uq_owner_document')
    )
    op.create_index('ix_owners_client', 'owners', ['client_id'])
    op.create_index('ix_owners_document', 'owners', ['document_type', 'document_number'])

    # ========================================================================
    # TABLA: import_batches
    # ========================================================================
    op.create_table(
        'import_batches',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('import_type', sa.String(length=50), nullable=False),
        sa.Column('file_name', sa.String(length=255), nullable=False),
        sa.Column('file_url', sa.String(length=500), nullable=True),
        sa.Column('total_rows', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('successful_rows', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('failed_rows', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='pending'),
        sa.Column('imported_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('imported_by', sa.Integer(), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['imported_by'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_import_batch_type', 'import_batches', ['import_type'])
    op.create_index('ix_import_batch_status', 'import_batches', ['status'])
    op.create_index('ix_import_batch_date', 'import_batches', ['imported_at'])

    # ========================================================================
    # TABLA: contracts
    # ========================================================================
    op.create_table(
        'contracts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('contract_number', sa.String(length=50), nullable=False),
        sa.Column('owner_id', sa.Integer(), nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=False),
        sa.Column('lot_id', sa.Integer(), nullable=False),
        sa.Column('advisor_id', sa.Integer(), nullable=True),
        sa.Column('contract_date', sa.Date(), nullable=False),
        sa.Column('start_date', sa.Date(), nullable=False),
        sa.Column('lot_area_m2', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('price_per_m2', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('total_price', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column('payment_modality', sa.String(length=20), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='activo'),
        sa.Column('contract_pdf_url', sa.String(length=500), nullable=True),
        sa.Column('contract_pdf_public_id', sa.String(length=255), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('updated_by', sa.Integer(), nullable=True),
        sa.Column('is_imported', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('import_batch_id', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['owner_id'], ['owners.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['lot_id'], ['lots.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['advisor_id'], ['advisors.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['updated_by'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['import_batch_id'], ['import_batches.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('contract_number', name='uq_contract_number')
    )
    op.create_index('ix_contracts_owner', 'contracts', ['owner_id'])
    op.create_index('ix_contracts_project', 'contracts', ['project_id'])
    op.create_index('ix_contracts_lot', 'contracts', ['lot_id'])
    op.create_index('ix_contracts_status', 'contracts', ['status'])
    op.create_index('ix_contracts_modality', 'contracts', ['payment_modality'])

    # ========================================================================
    # TABLA: property_ownerships
    # ========================================================================
    op.create_table(
        'property_ownerships',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('owner_id', sa.Integer(), nullable=False),
        sa.Column('lot_id', sa.Integer(), nullable=False),
        sa.Column('contract_id', sa.Integer(), nullable=False),
        sa.Column('ownership_percentage', sa.Numeric(precision=5, scale=2), nullable=False, server_default='100.00'),
        sa.Column('role', sa.String(length=20), nullable=False, server_default='titular'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.CheckConstraint('ownership_percentage >= 0 AND ownership_percentage <= 100', name='ck_ownership_percentage_range'),
        sa.ForeignKeyConstraint(['owner_id'], ['owners.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['lot_id'], ['lots.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['contract_id'], ['contracts.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('contract_id', 'owner_id', name='uq_ownership_contract_owner')
    )
    op.create_index('ix_ownerships_owner', 'property_ownerships', ['owner_id'])
    op.create_index('ix_ownerships_lot', 'property_ownerships', ['lot_id'])
    op.create_index('ix_ownerships_contract', 'property_ownerships', ['contract_id'])

    # ========================================================================
    # TABLA: cash_payments
    # ========================================================================
    op.create_table(
        'cash_payments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('contract_id', sa.Integer(), nullable=False),
        sa.Column('total_amount', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column('amount_paid', sa.Numeric(precision=14, scale=2), nullable=False, server_default='0.00'),
        sa.Column('balance', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column('payment_date', sa.Date(), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='pendiente'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint('amount_paid >= 0', name='ck_cash_amount_paid_positive'),
        sa.CheckConstraint('balance >= 0', name='ck_cash_balance_positive'),
        sa.CheckConstraint('amount_paid <= total_amount', name='ck_cash_amount_valid'),
        sa.ForeignKeyConstraint(['contract_id'], ['contracts.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('contract_id', name='uq_cash_payment_contract')
    )

    # ========================================================================
    # TABLA: financing_plans
    # ========================================================================
    op.create_table(
        'financing_plans',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('contract_id', sa.Integer(), nullable=False),
        sa.Column('total_price', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column('initial_payment', sa.Numeric(precision=14, scale=2), nullable=False, server_default='0.00'),
        sa.Column('financed_amount', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column('number_of_installments', sa.Integer(), nullable=False),
        sa.Column('installment_amount', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('frequency', sa.String(length=20), nullable=False, server_default='mensual'),
        sa.Column('first_installment_date', sa.Date(), nullable=False),
        sa.Column('last_installment_date', sa.Date(), nullable=False),
        sa.Column('interest_rate', sa.Numeric(precision=5, scale=2), nullable=True, server_default='0.00'),
        sa.Column('total_interest', sa.Numeric(precision=14, scale=2), nullable=True, server_default='0.00'),
        sa.Column('outstanding_balance', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint('initial_payment >= 0', name='ck_financing_initial_positive'),
        sa.CheckConstraint('financed_amount > 0', name='ck_financing_amount_positive'),
        sa.CheckConstraint('number_of_installments > 0', name='ck_financing_installments_positive'),
        sa.CheckConstraint('installment_amount > 0', name='ck_financing_installment_amount_positive'),
        sa.CheckConstraint('interest_rate >= 0', name='ck_financing_interest_rate_positive'),
        sa.CheckConstraint('outstanding_balance >= 0', name='ck_financing_balance_positive'),
        sa.ForeignKeyConstraint(['contract_id'], ['contracts.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('contract_id', name='uq_financing_plan_contract')
    )

    # ========================================================================
    # TABLA: installments
    # ========================================================================
    op.create_table(
        'installments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('financing_plan_id', sa.Integer(), nullable=False),
        sa.Column('installment_number', sa.Integer(), nullable=False),
        sa.Column('due_date', sa.Date(), nullable=False),
        sa.Column('payment_date', sa.Date(), nullable=True),
        sa.Column('scheduled_amount', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('paid_amount', sa.Numeric(precision=12, scale=2), nullable=False, server_default='0.00'),
        sa.Column('balance', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='pendiente'),
        sa.Column('days_overdue', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint('scheduled_amount > 0', name='ck_installment_scheduled_positive'),
        sa.CheckConstraint('paid_amount >= 0', name='ck_installment_paid_positive'),
        sa.CheckConstraint('balance >= 0', name='ck_installment_balance_positive'),
        sa.CheckConstraint('paid_amount <= scheduled_amount', name='ck_installment_paid_valid'),
        sa.CheckConstraint('days_overdue >= 0', name='ck_installment_days_overdue_positive'),
        sa.ForeignKeyConstraint(['financing_plan_id'], ['financing_plans.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('financing_plan_id', 'installment_number', name='uq_installment_number')
    )
    op.create_index('ix_installments_financing', 'installments', ['financing_plan_id'])
    op.create_index('ix_installments_due_date', 'installments', ['due_date'])
    op.create_index('ix_installments_status', 'installments', ['status'])

    # ========================================================================
    # TABLA: payments
    # ========================================================================
    op.create_table(
        'payments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('contract_id', sa.Integer(), nullable=False),
        sa.Column('payer_id', sa.Integer(), nullable=False),
        sa.Column('payment_date', sa.Date(), nullable=False),
        sa.Column('amount', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('payment_method', sa.String(length=20), nullable=False, server_default='efectivo'),
        sa.Column('transaction_number', sa.String(length=100), nullable=True),
        sa.Column('bank_name', sa.String(length=100), nullable=True),
        sa.Column('receipt_url', sa.String(length=500), nullable=True),
        sa.Column('receipt_public_id', sa.String(length=255), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('is_cancelled', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('cancelled_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('cancellation_reason', sa.Text(), nullable=True),
        sa.Column('cancelled_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('is_imported', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('import_batch_id', sa.Integer(), nullable=True),
        sa.CheckConstraint('amount > 0', name='ck_payment_amount_positive'),
        sa.ForeignKeyConstraint(['contract_id'], ['contracts.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['payer_id'], ['owners.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['cancelled_by'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['import_batch_id'], ['import_batches.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_payments_contract', 'payments', ['contract_id'])
    op.create_index('ix_payments_payer', 'payments', ['payer_id'])
    op.create_index('ix_payments_date', 'payments', ['payment_date'])
    op.create_index('ix_payments_cancelled', 'payments', ['is_cancelled'])

    # ========================================================================
    # TABLA: payment_allocations
    # ========================================================================
    op.create_table(
        'payment_allocations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('payment_id', sa.Integer(), nullable=False),
        sa.Column('installment_id', sa.Integer(), nullable=False),
        sa.Column('allocated_amount', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint('allocated_amount > 0', name='ck_allocation_amount_positive'),
        sa.ForeignKeyConstraint(['payment_id'], ['payments.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['installment_id'], ['installments.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_allocations_payment', 'payment_allocations', ['payment_id'])
    op.create_index('ix_allocations_installment', 'payment_allocations', ['installment_id'])

    # ========================================================================
    # TABLA: contract_documents
    # ========================================================================
    op.create_table(
        'contract_documents',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('contract_id', sa.Integer(), nullable=False),
        sa.Column('document_name', sa.String(length=255), nullable=False),
        sa.Column('document_type', sa.String(length=50), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('file_url', sa.String(length=500), nullable=False),
        sa.Column('file_public_id', sa.String(length=255), nullable=True),
        sa.Column('file_size', sa.Integer(), nullable=True),
        sa.Column('uploaded_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('uploaded_by', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['contract_id'], ['contracts.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['uploaded_by'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_contract_docs_contract', 'contract_documents', ['contract_id'])
    op.create_index('ix_contract_docs_type', 'contract_documents', ['document_type'])

    # ========================================================================
    # TABLA: import_errors
    # ========================================================================
    op.create_table(
        'import_errors',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('batch_id', sa.Integer(), nullable=False),
        sa.Column('row_number', sa.Integer(), nullable=False),
        sa.Column('field_name', sa.String(length=100), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=False),
        sa.Column('row_data', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['batch_id'], ['import_batches.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_import_errors_batch', 'import_errors', ['batch_id'])


def downgrade():
    # Eliminar en orden inverso por dependencias
    op.drop_index('ix_import_errors_batch', 'import_errors')
    op.drop_table('import_errors')
    
    op.drop_index('ix_contract_docs_type', 'contract_documents')
    op.drop_index('ix_contract_docs_contract', 'contract_documents')
    op.drop_table('contract_documents')
    
    op.drop_index('ix_allocations_installment', 'payment_allocations')
    op.drop_index('ix_allocations_payment', 'payment_allocations')
    op.drop_table('payment_allocations')
    
    op.drop_index('ix_payments_cancelled', 'payments')
    op.drop_index('ix_payments_date', 'payments')
    op.drop_index('ix_payments_payer', 'payments')
    op.drop_index('ix_payments_contract', 'payments')
    op.drop_table('payments')
    
    op.drop_index('ix_installments_status', 'installments')
    op.drop_index('ix_installments_due_date', 'installments')
    op.drop_index('ix_installments_financing', 'installments')
    op.drop_table('installments')
    
    op.drop_table('financing_plans')
    op.drop_table('cash_payments')
    
    op.drop_index('ix_ownerships_contract', 'property_ownerships')
    op.drop_index('ix_ownerships_lot', 'property_ownerships')
    op.drop_index('ix_ownerships_owner', 'property_ownerships')
    op.drop_table('property_ownerships')
    
    op.drop_index('ix_contracts_modality', 'contracts')
    op.drop_index('ix_contracts_status', 'contracts')
    op.drop_index('ix_contracts_lot', 'contracts')
    op.drop_index('ix_contracts_project', 'contracts')
    op.drop_index('ix_contracts_owner', 'contracts')
    op.drop_table('contracts')
    
    op.drop_index('ix_import_batch_date', 'import_batches')
    op.drop_index('ix_import_batch_status', 'import_batches')
    op.drop_index('ix_import_batch_type', 'import_batches')
    op.drop_table('import_batches')
    
    op.drop_index('ix_owners_document', 'owners')
    op.drop_index('ix_owners_client', 'owners')
    op.drop_table('owners')
