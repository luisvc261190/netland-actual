"""
Módulo de Propietarios y Cobranzas - Modelos de Dominio
Sigue las 3 formas normales de base de datos
"""
from datetime import date, datetime
from decimal import Decimal
from enum import Enum

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


# ============================================================================
# ENUMS
# ============================================================================

class PersonType(str, Enum):
    """Tipo de persona"""
    NATURAL = "natural"
    JURIDICA = "juridica"


class DocumentType(str, Enum):
    """Tipos de documento de identidad"""
    DNI = "DNI"
    RUC = "RUC"
    CE = "CE"
    PASAPORTE = "PASAPORTE"
    OTRO = "OTRO"


class PaymentModality(str, Enum):
    """Modalidad de pago de la compra"""
    CONTADO = "contado"
    FINANCIADO = "financiado"


class ContractStatus(str, Enum):
    """Estado del contrato"""
    ACTIVO = "activo"
    CANCELADO = "cancelado"
    RESUELTO = "resuelto"
    ANULADO = "anulado"


class PaymentStatus(str, Enum):
    """Estado del pago de contado"""
    PAGADO = "pagado"
    PENDIENTE = "pendiente"


class InstallmentStatus(str, Enum):
    """Estado de una cuota"""
    PENDIENTE = "pendiente"
    PAGADA = "pagada"
    PARCIAL = "parcial"
    VENCIDA = "vencida"
    ANULADA = "anulada"


class PaymentFrequency(str, Enum):
    """Frecuencia de pago de cuotas"""
    MENSUAL = "mensual"
    QUINCENAL = "quincenal"
    SEMANAL = "semanal"
    PERSONALIZADA = "personalizada"


class OwnershipRole(str, Enum):
    """Rol del propietario en la propiedad"""
    TITULAR = "titular"
    COTITULAR = "cotitular"
    COPROPIETARIO = "copropietario"


class PaymentMethod(str, Enum):
    """Medio de pago"""
    EFECTIVO = "efectivo"
    TRANSFERENCIA = "transferencia"
    DEPOSITO = "deposito"
    CHEQUE = "cheque"
    TARJETA = "tarjeta"
    YAPE = "yape"
    PLIN = "plin"
    OTRO = "otro"


class CollectionStatus(str, Enum):
    """Estado de cobranza"""
    AL_DIA = "al_dia"
    PROXIMO_VENCER = "proximo_vencer"
    VENCIDO = "vencido"
    CANCELADO = "cancelado"


# ============================================================================
# PROPIETARIOS (Extiende Client)
# ============================================================================

class Owner(Base):
    """
    Propietarios de lotes.
    Extiende la tabla clients con información adicional específica.
    Sigue 1FN, 2FN, 3FN: todos los atributos dependen de la clave primaria.
    """
    __tablename__ = "owners"

    id = Column(Integer, primary_key=True)
    client_id = Column(
        Integer, 
        ForeignKey("clients.id", ondelete="CASCADE"), 
        nullable=False,
        unique=True,
        index=True
    )
    
    # Tipo de persona
    person_type = Column(String(20), nullable=False, default="natural")  # natural | juridica
    
    # Documentos
    document_type = Column(String(20), nullable=False, default="DNI")
    document_number = Column(String(20), nullable=False, index=True)
    
    # Datos personales (persona natural)
    first_name = Column(String(120), nullable=True)
    paternal_surname = Column(String(120), nullable=True)
    maternal_surname = Column(String(120), nullable=True)
    
    # Datos empresa (persona jurídica)
    business_name = Column(String(255), nullable=True)
    
    # Contacto adicional
    secondary_phone = Column(String(30), nullable=True)
    address = Column(String(255), nullable=True)
    district = Column(String(100), nullable=True)
    province = Column(String(100), nullable=True)
    department = Column(String(100), nullable=True)
    
    # Fecha de nacimiento
    birth_date = Column(Date, nullable=True)
    
    # Estado y observaciones
    is_active = Column(Boolean, default=True, nullable=False)
    notes = Column(Text, nullable=True)
    
    # Auditoría
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Relaciones
    client = relationship("Client", backref="owner_profile")
    ownerships = relationship("PropertyOwnership", back_populates="owner", cascade="all, delete-orphan")
    contracts = relationship("Contract", back_populates="owner", cascade="all, delete-orphan")
    payments_made = relationship("Payment", back_populates="payer", foreign_keys="Payment.payer_id")
    
    # Constraints
    __table_args__ = (
        UniqueConstraint("document_type", "document_number", name="uq_owner_document"),
        CheckConstraint(
            "(person_type = 'natural' AND first_name IS NOT NULL) OR "
            "(person_type = 'juridica' AND business_name IS NOT NULL)",
            name="ck_owner_person_data"
        ),
        Index("ix_owners_document", "document_type", "document_number"),
        Index("ix_owners_client", "client_id"),
    )


# ============================================================================
# COPROPIEDADES
# ============================================================================

class PropertyOwnership(Base):
    """
    Relación muchos-a-muchos entre Propietarios y Lotes.
    Permite copropietarios con porcentajes de propiedad.
    3FN: No hay dependencias transitivas.
    """
    __tablename__ = "property_ownerships"

    id = Column(Integer, primary_key=True)
    owner_id = Column(
        Integer, 
        ForeignKey("owners.id", ondelete="CASCADE"), 
        nullable=False,
        index=True
    )
    lot_id = Column(
        Integer, 
        ForeignKey("lots.id", ondelete="CASCADE"), 
        nullable=False,
        index=True
    )
    contract_id = Column(
        Integer,
        ForeignKey("contracts.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    # Porcentaje de propiedad (debe sumar 100% por lote)
    ownership_percentage = Column(
        Numeric(5, 2), 
        nullable=False, 
        default=Decimal("100.00")
    )
    
    # Rol del propietario
    role = Column(String(20), nullable=False, default="titular")  # titular | cotitular | copropietario
    
    # Auditoría
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Relaciones
    owner = relationship("Owner", back_populates="ownerships")
    lot = relationship("Lot", backref="ownerships")
    contract = relationship("Contract", back_populates="ownerships")

    # Constraints
    __table_args__ = (
        UniqueConstraint("contract_id", "owner_id", name="uq_ownership_contract_owner"),
        CheckConstraint(
            "ownership_percentage >= 0 AND ownership_percentage <= 100",
            name="ck_ownership_percentage_range"
        ),
        Index("ix_ownerships_owner", "owner_id"),
        Index("ix_ownerships_lot", "lot_id"),
        Index("ix_ownerships_contract", "contract_id"),
    )


# ============================================================================
# CONTRATOS
# ============================================================================

class Contract(Base):
    """
    Contratos de compra-venta de lotes.
    Almacena la información principal de la transacción.
    3FN: Todos los atributos dependen solo de contract_id.
    """
    __tablename__ = "contracts"

    id = Column(Integer, primary_key=True)
    contract_number = Column(String(50), unique=True, nullable=False, index=True)
    
    # Relaciones principales
    owner_id = Column(
        Integer,
        ForeignKey("owners.id", ondelete="RESTRICT"),
        nullable=False,
        index=True
    )
    project_id = Column(
        Integer,
        ForeignKey("projects.id", ondelete="RESTRICT"),
        nullable=False,
        index=True
    )
    lot_id = Column(
        Integer,
        ForeignKey("lots.id", ondelete="RESTRICT"),
        nullable=False,
        index=True
    )
    advisor_id = Column(
        Integer,
        ForeignKey("advisors.id", ondelete="SET NULL"),
        nullable=True
    )
    
    # Fechas
    contract_date = Column(Date, nullable=False)
    start_date = Column(Date, nullable=False)  # Fecha de inicio del contrato
    
    # Información del lote al momento de la venta
    lot_area_m2 = Column(Numeric(10, 2), nullable=False)
    price_per_m2 = Column(Numeric(12, 2), nullable=False)
    total_price = Column(Numeric(14, 2), nullable=False)

    # Recargos y descuento (misma lógica que las cotizaciones)
    esquina_surcharge = Column(Numeric(12, 2), default=Decimal("0.00"))
    frente_parque_surcharge = Column(Numeric(12, 2), default=Decimal("0.00"))
    frente_a_pista_surcharge = Column(Numeric(12, 2), default=Decimal("0.00"))
    discount_type = Column(String(20), default="none")  # none | percentage | fixed
    discount_value = Column(Numeric(12, 2), default=Decimal("0.00"))
    
    # Modalidad de pago
    payment_modality = Column(String(20), nullable=False)  # contado | financiado
    
    # Estado del contrato
    status = Column(String(20), nullable=False, default="activo")  # activo | cancelado | resuelto | anulado
    
    # Documento del contrato (PDF)
    contract_pdf_url = Column(String(500), nullable=True)
    contract_pdf_public_id = Column(String(255), nullable=True)
    
    # Observaciones
    notes = Column(Text, nullable=True)
    
    # Auditoría
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    # Campos para datos históricos importados
    is_imported = Column(Boolean, default=False, nullable=False)
    import_batch_id = Column(
        Integer,
        ForeignKey("import_batches.id", ondelete="SET NULL"),
        nullable=True
    )

    # Relaciones
    owner = relationship("Owner", back_populates="contracts")
    project = relationship("Project")
    lot = relationship("Lot", backref="contracts")
    advisor = relationship("Advisor")
    ownerships = relationship("PropertyOwnership", back_populates="contract", cascade="all, delete-orphan")
    cash_payment = relationship("CashPayment", back_populates="contract", uselist=False, cascade="all, delete-orphan")
    financing = relationship("FinancingPlan", back_populates="contract", uselist=False, cascade="all, delete-orphan")
    documents = relationship("ContractDocument", back_populates="contract", cascade="all, delete-orphan")

    @hybrid_property
    def lot_pdf_url(self) -> str | None:
        """URL del PDF del contrato almacenada en el lote (generada una sola vez)."""
        if self.lot is not None:
            return self.lot.contract_pdf_url
        return None

    # Constraints
    __table_args__ = (
        Index("ix_contracts_owner", "owner_id"),
        Index("ix_contracts_project", "project_id"),
        Index("ix_contracts_lot", "lot_id"),
        Index("ix_contracts_status", "status"),
        Index("ix_contracts_modality", "payment_modality"),
    )


# ============================================================================
# PAGO AL CONTADO
# ============================================================================

class CashPayment(Base):
    """
    Información de pago al contado.
    Tabla separada para cumplir 3FN (evitar atributos nulos masivos en Contract).
    """
    __tablename__ = "cash_payments"

    id = Column(Integer, primary_key=True)
    contract_id = Column(
        Integer,
        ForeignKey("contracts.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True
    )
    
    # Montos
    total_amount = Column(Numeric(14, 2), nullable=False)
    amount_paid = Column(Numeric(14, 2), nullable=False, default=Decimal("0.00"))
    balance = Column(Numeric(14, 2), nullable=False)
    
    # Fecha de pago
    payment_date = Column(Date, nullable=True)
    
    # Estado
    status = Column(String(20), nullable=False, default="pendiente")  # pagado | pendiente
    
    # Auditoría
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relaciones
    contract = relationship("Contract", back_populates="cash_payment")

    # Constraints
    __table_args__ = (
        CheckConstraint("amount_paid >= 0", name="ck_cash_amount_paid_positive"),
        CheckConstraint("balance >= 0", name="ck_cash_balance_positive"),
        CheckConstraint("amount_paid <= total_amount", name="ck_cash_amount_valid"),
    )


# ============================================================================
# PLAN DE FINANCIAMIENTO
# ============================================================================

class FinancingPlan(Base):
    """
    Plan de financiamiento directo con la empresa.
    Tabla separada para cumplir 3FN.
    """
    __tablename__ = "financing_plans"

    id = Column(Integer, primary_key=True)
    contract_id = Column(
        Integer,
        ForeignKey("contracts.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True
    )
    
    # Montos
    total_price = Column(Numeric(14, 2), nullable=False)
    initial_payment = Column(Numeric(14, 2), nullable=False, default=Decimal("0.00"))
    financed_amount = Column(Numeric(14, 2), nullable=False)
    
    # Cuotas
    number_of_installments = Column(Integer, nullable=False)
    installment_amount = Column(Numeric(12, 2), nullable=False)
    frequency = Column(String(20), nullable=False, default="mensual")  # mensual | quincenal | semanal | personalizada
    
    # Fechas
    first_installment_date = Column(Date, nullable=False)
    last_installment_date = Column(Date, nullable=False)
    
    # Intereses (opcional, puede ser 0)
    interest_rate = Column(Numeric(5, 2), nullable=True, default=Decimal("0.00"))
    total_interest = Column(Numeric(14, 2), nullable=True, default=Decimal("0.00"))
    
    # Saldo capital pendiente (se actualiza con los pagos)
    outstanding_balance = Column(Numeric(14, 2), nullable=False)
    
    # Auditoría
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relaciones
    contract = relationship("Contract", back_populates="financing")
    installments = relationship("Installment", back_populates="financing", cascade="all, delete-orphan")

    # Constraints
    __table_args__ = (
        CheckConstraint("initial_payment >= 0", name="ck_financing_initial_positive"),
        CheckConstraint("financed_amount > 0", name="ck_financing_amount_positive"),
        CheckConstraint("number_of_installments > 0", name="ck_financing_installments_positive"),
        CheckConstraint("installment_amount > 0", name="ck_financing_installment_amount_positive"),
        CheckConstraint("interest_rate >= 0", name="ck_financing_interest_rate_positive"),
        CheckConstraint("outstanding_balance >= 0", name="ck_financing_balance_positive"),
    )


# ============================================================================
# CUOTAS
# ============================================================================

class Installment(Base):
    """
    Cuotas del cronograma de pagos.
    Cada cuota es una fila independiente (1FN).
    """
    __tablename__ = "installments"

    id = Column(Integer, primary_key=True)
    financing_plan_id = Column(
        Integer,
        ForeignKey("financing_plans.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    # Número de cuota
    installment_number = Column(Integer, nullable=False)
    
    # Fechas
    due_date = Column(Date, nullable=False, index=True)
    payment_date = Column(Date, nullable=True)
    
    # Montos
    scheduled_amount = Column(Numeric(12, 2), nullable=False)
    paid_amount = Column(Numeric(12, 2), nullable=False, default=Decimal("0.00"))
    balance = Column(Numeric(12, 2), nullable=False)
    
    # Estado
    status = Column(String(20), nullable=False, default="pendiente")  # pendiente | pagada | parcial | vencida | anulada
    
    # Días de atraso (calculado)
    days_overdue = Column(Integer, nullable=False, default=0)
    
    # Auditoría
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relaciones
    financing = relationship("FinancingPlan", back_populates="installments")
    payment_allocations = relationship("PaymentAllocation", back_populates="installment", cascade="all, delete-orphan")

    # Constraints
    __table_args__ = (
        UniqueConstraint("financing_plan_id", "installment_number", name="uq_installment_number"),
        CheckConstraint("scheduled_amount > 0", name="ck_installment_scheduled_positive"),
        CheckConstraint("paid_amount >= 0", name="ck_installment_paid_positive"),
        CheckConstraint("balance >= 0", name="ck_installment_balance_positive"),
        CheckConstraint("paid_amount <= scheduled_amount", name="ck_installment_paid_valid"),
        CheckConstraint("days_overdue >= 0", name="ck_installment_days_overdue_positive"),
        Index("ix_installments_financing", "financing_plan_id"),
        Index("ix_installments_due_date", "due_date"),
        Index("ix_installments_status", "status"),
    )


# ============================================================================
# PAGOS
# ============================================================================

class Payment(Base):
    """
    Registro de pagos realizados por los propietarios.
    Un pago puede aplicarse a una o más cuotas (PaymentAllocation).
    3FN: Información del pago separada de su aplicación.
    """
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True)
    
    # Relaciones
    contract_id = Column(
        Integer,
        ForeignKey("contracts.id", ondelete="RESTRICT"),
        nullable=False,
        index=True
    )
    payer_id = Column(
        Integer,
        ForeignKey("owners.id", ondelete="RESTRICT"),
        nullable=False,
        index=True
    )
    
    # Información del pago
    payment_date = Column(Date, nullable=False, index=True)
    amount = Column(Numeric(12, 2), nullable=False)
    payment_method = Column(String(20), nullable=False, default="efectivo")
    
    # Datos de la transacción
    transaction_number = Column(String(100), nullable=True)
    bank_name = Column(String(100), nullable=True)
    
    # Comprobante
    receipt_url = Column(String(500), nullable=True)
    receipt_public_id = Column(String(255), nullable=True)
    
    # Observaciones
    notes = Column(Text, nullable=True)
    
    # Estado (para anulaciones)
    is_cancelled = Column(Boolean, default=False, nullable=False)
    cancelled_at = Column(DateTime(timezone=True), nullable=True)
    cancellation_reason = Column(Text, nullable=True)
    cancelled_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    # Auditoría
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    # Para importaciones históricas
    is_imported = Column(Boolean, default=False, nullable=False)
    import_batch_id = Column(
        Integer,
        ForeignKey("import_batches.id", ondelete="SET NULL"),
        nullable=True
    )

    # Relaciones
    contract = relationship("Contract", backref="payments")
    payer = relationship("Owner", back_populates="payments_made", foreign_keys=[payer_id])
    allocations = relationship("PaymentAllocation", back_populates="payment", cascade="all, delete-orphan")

    # Constraints
    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_payment_amount_positive"),
        Index("ix_payments_contract", "contract_id"),
        Index("ix_payments_payer", "payer_id"),
        Index("ix_payments_date", "payment_date"),
        Index("ix_payments_cancelled", "is_cancelled"),
    )


# ============================================================================
# DISTRIBUCIÓN DE PAGOS
# ============================================================================

class PaymentAllocation(Base):
    """
    Distribución de un pago a cuotas específicas.
    Permite pagos parciales y adelantados.
    Mantiene trazabilidad completa (3FN).
    """
    __tablename__ = "payment_allocations"

    id = Column(Integer, primary_key=True)
    payment_id = Column(
        Integer,
        ForeignKey("payments.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    installment_id = Column(
        Integer,
        ForeignKey("installments.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    # Monto aplicado a esta cuota
    allocated_amount = Column(Numeric(12, 2), nullable=False)
    
    # Auditoría
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relaciones
    payment = relationship("Payment", back_populates="allocations")
    installment = relationship("Installment", back_populates="payment_allocations")

    # Constraints
    __table_args__ = (
        CheckConstraint("allocated_amount > 0", name="ck_allocation_amount_positive"),
        Index("ix_allocations_payment", "payment_id"),
        Index("ix_allocations_installment", "installment_id"),
    )


# ============================================================================
# DOCUMENTOS DEL CONTRATO
# ============================================================================

class ContractDocument(Base):
    """
    Documentos asociados al contrato (DNI, comprobantes, contratos, etc.).
    """
    __tablename__ = "contract_documents"

    id = Column(Integer, primary_key=True)
    contract_id = Column(
        Integer,
        ForeignKey("contracts.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    # Información del documento
    document_name = Column(String(255), nullable=False)
    document_type = Column(String(50), nullable=False)  # contrato, dni, comprobante, recibo, etc.
    description = Column(Text, nullable=True)
    
    # Archivo
    file_url = Column(String(500), nullable=False)
    file_public_id = Column(String(255), nullable=True)
    file_size = Column(Integer, nullable=True)  # tamaño en bytes
    
    # Auditoría
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    uploaded_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Relaciones
    contract = relationship("Contract", back_populates="documents")

    # Constraints
    __table_args__ = (
        Index("ix_contract_docs_contract", "contract_id"),
        Index("ix_contract_docs_type", "document_type"),
    )


# ============================================================================
# IMPORTACIÓN EXCEL
# ============================================================================

class ImportBatch(Base):
    """
    Lote de importación desde Excel.
    Mantiene trazabilidad de importaciones masivas.
    """
    __tablename__ = "import_batches"

    id = Column(Integer, primary_key=True)
    
    # Tipo de importación
    import_type = Column(String(50), nullable=False)  # owners, contracts, payments
    
    # Archivo
    file_name = Column(String(255), nullable=False)
    file_url = Column(String(500), nullable=True)
    
    # Estadísticas
    total_rows = Column(Integer, nullable=False, default=0)
    successful_rows = Column(Integer, nullable=False, default=0)
    failed_rows = Column(Integer, nullable=False, default=0)
    
    # Estado
    status = Column(String(20), nullable=False, default="pending")  # pending, processing, completed, failed
    
    # Auditoría
    imported_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    imported_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # Relaciones
    errors = relationship("ImportError", back_populates="batch", cascade="all, delete-orphan")

    # Constraints
    __table_args__ = (
        Index("ix_import_batch_type", "import_type"),
        Index("ix_import_batch_status", "status"),
        Index("ix_import_batch_date", "imported_at"),
    )


class ImportError(Base):
    """
    Errores detectados durante la importación.
    """
    __tablename__ = "import_errors"

    id = Column(Integer, primary_key=True)
    batch_id = Column(
        Integer,
        ForeignKey("import_batches.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    # Información del error
    row_number = Column(Integer, nullable=False)
    field_name = Column(String(100), nullable=True)
    error_message = Column(Text, nullable=False)
    row_data = Column(Text, nullable=True)  # JSON con los datos de la fila
    
    # Auditoría
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relaciones
    batch = relationship("ImportBatch", back_populates="errors")

    # Constraints
    __table_args__ = (
        Index("ix_import_errors_batch", "batch_id"),
    )
