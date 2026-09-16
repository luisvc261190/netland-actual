"""
Módulo de Comisiones y Planillas - Modelos de Dominio
Gestión de porcentajes de comisión por asesor/proyecto y pagos de
comisiones de venta y mensualidades de asesores.
"""
from datetime import datetime
from decimal import Decimal

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
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class CommissionPaymentType(str):
    COMISION = "comision"
    MENSUALIDAD = "mensualidad"


class CommissionPaymentStatus(str):
    PENDIENTE = "pendiente"
    PARCIAL = "parcial"
    PAGADO = "pagado"
    ANULADO = "anulado"


class AdvisorCommission(Base):
    """
    Porcentaje de comisión configurado para un asesor en un proyecto.
    Cada asesor puede comisionar un porcentaje distinto según el proyecto.
    Un mismo par (asesor, proyecto) solo puede tener una configuración activa.
    """
    __tablename__ = "advisor_commissions"

    id = Column(Integer, primary_key=True)
    advisor_id = Column(
        Integer,
        ForeignKey("advisors.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    project_id = Column(
        Integer,
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    commission_percent = Column(Numeric(5, 2), nullable=False)

    # Estado
    is_active = Column(Boolean, default=True, nullable=False)

    # Auditoría
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Eliminación lógica
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    # Relaciones
    advisor = relationship("Advisor")
    project = relationship("Project")

    __table_args__ = (
        UniqueConstraint("advisor_id", "project_id", "deleted_at", name="uq_advisor_commission_pair"),
        CheckConstraint(
            "commission_percent >= 0 AND commission_percent <= 100",
            name="ck_commission_percent_range",
        ),
        Index("ix_advisor_commissions_advisor", "advisor_id"),
        Index("ix_advisor_commissions_project", "project_id"),
    )


class CommissionPayment(Base):
    """
    Registro de pago de comisión de venta o mensualidad de asesor.
    Almacena un snapshot de los datos del asesor (nombre, documento y cuenta
    bancaria) al momento de la creación para preservar la trazabilidad.
    Sigue el control de estados: pendiente -> pagado | anulado.
    """
    __tablename__ = "commission_payments"

    id = Column(Integer, primary_key=True)

    # Tipo de pago: comision | mensualidad
    payment_type = Column(String(20), nullable=False, index=True)

    # Relaciones informativas (el snapshot mantiene la trazabilidad)
    advisor_id = Column(Integer, ForeignKey("advisors.id", ondelete="SET NULL"), nullable=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True)
    contract_id = Column(Integer, ForeignKey("contracts.id", ondelete="SET NULL"), nullable=True)

    # Snapshots de contexto
    contract_number = Column(String(50), nullable=True)
    project_name = Column(String(200), nullable=True)

    # Montos
    percent_applied = Column(Numeric(5, 2), nullable=True)
    base_amount = Column(Numeric(14, 2), nullable=True)
    amount = Column(Numeric(14, 2), nullable=False)
    amount_paid = Column(Numeric(14, 2), nullable=False, server_default="0")

    # Origen del registro: auto (generada al registrar la venta) | manual
    origin = Column(String(20), nullable=False, server_default="manual")

    # Descripción y período (mensualidad: "2026-09")
    concept = Column(String(255), nullable=False, server_default="")
    payment_period = Column(String(10), nullable=True)

    # Snapshot de datos del asesor al momento de la creación
    advisor_name = Column(String(120), nullable=False)
    document_type = Column(String(20), nullable=False, server_default="DNI")
    document_number = Column(String(30), nullable=False, server_default="")
    bank_name = Column(String(100), nullable=False, server_default="")
    account_number = Column(String(60), nullable=False, server_default="")

    # Estado del pago: pendiente | pagado | anulado
    payment_status = Column(String(20), nullable=False, server_default="pendiente", index=True)
    payment_date = Column(Date, nullable=True)
    payment_method = Column(String(20), nullable=True)
    transaction_number = Column(String(100), nullable=True)

    # Observaciones
    notes = Column(Text, nullable=True)

    # Anulación
    cancelled_at = Column(DateTime(timezone=True), nullable=True)
    cancellation_reason = Column(Text, nullable=True)
    cancelled_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Auditoría
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Eliminación lógica
    deleted_at = Column(DateTime(timezone=True), nullable=True, index=True)

    # Relaciones
    advisor = relationship("Advisor")
    project = relationship("Project")
    contract = relationship("Contract")

    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_commission_amount_positive"),
        CheckConstraint(
            "amount_paid >= 0 AND amount_paid <= amount",
            name="ck_commission_amount_paid_range",
        ),
        CheckConstraint(
            "payment_status IN ('pendiente', 'parcial', 'pagado', 'anulado')",
            name="ck_commission_status",
        ),
        Index("ix_commission_payments_type", "payment_type"),
        Index("ix_commission_payments_status", "payment_status"),
        Index("ix_commission_payments_advisor", "advisor_id"),
        Index("ix_commission_payments_project", "project_id"),
        Index("ix_commission_payments_date", "payment_date"),
    )