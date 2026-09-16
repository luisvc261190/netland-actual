"""
Schemas Pydantic para el módulo de Comisiones y Planillas
"""
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.domain.commission_models import (
    CommissionPaymentStatus,
    CommissionPaymentType,
)


class AdvisorCommissionCreate(BaseModel):
    advisor_id: int
    project_id: int
    commission_percent: Decimal = Field(..., ge=0, le=100, description="Porcentaje de comisión (0-100)")
    is_active: bool = True


class AdvisorCommissionUpdate(BaseModel):
    commission_percent: Decimal | None = Field(default=None, ge=0, le=100)
    is_active: bool | None = None


class AdvisorCommissionOut(BaseModel):
    id: int
    advisor_id: int
    project_id: int
    advisor_name: str
    project_name: str
    commission_percent: float
    is_active: bool
    deleted_at: str | None = None

    model_config = ConfigDict(from_attributes=True)


class CommissionPaymentCreate(BaseModel):
    payment_type: str = Field(..., description="comision | mensualidad")
    advisor_id: int | None = None
    project_id: int | None = None
    contract_id: int | None = None
    base_amount: Decimal | None = Field(default=None, gt=0)
    percent_applied: Decimal | None = Field(default=None, ge=0, le=100)
    amount: Decimal | None = Field(default=None, gt=0)
    concept: str = ""
    payment_period: str | None = None
    notes: str = ""

    @field_validator("payment_type")
    @classmethod
    def validate_payment_type(cls, value: str) -> str:
        if value not in (CommissionPaymentType.COMISION, CommissionPaymentType.MENSUALIDAD):
            raise ValueError('payment_type debe ser "comision" o "mensualidad"')
        return value

    @field_validator("payment_period")
    @classmethod
    def validate_period(cls, value: str | None) -> str | None:
        if value is None:
            return value
        value = value.strip()
        if len(value) == 7 and value[4] == "-":
            year, month = value.split("-")
            if year.isdigit() and month.isdigit() and 1 <= int(month) <= 12:
                return value
        raise ValueError('payment_period debe tener el formato "AAAA-MM" (ej: 2026-09)')


class CommissionPaymentUpdate(BaseModel):
    advisor_id: int | None = None
    project_id: int | None = None
    base_amount: Decimal | None = Field(default=None, gt=0)
    percent_applied: Decimal | None = Field(default=None, ge=0, le=100)
    amount: Decimal | None = Field(default=None, gt=0)
    concept: str | None = None
    payment_period: str | None = None
    notes: str | None = None

    @field_validator("payment_period")
    @classmethod
    def validate_period(cls, value: str | None) -> str | None:
        if value is None or value == "":
            return value
        value = value.strip()
        if len(value) == 7 and value[4] == "-":
            year, month = value.split("-")
            if year.isdigit() and month.isdigit() and 1 <= int(month) <= 12:
                return value
        raise ValueError('payment_period debe tener el formato "AAAA-MM" (ej: 2026-09)')


class CommissionPaymentPay(BaseModel):
    payment_date: str | None = None
    payment_method: str | None = None
    transaction_number: str | None = None
    notes: str | None = None
    amount: Decimal | None = Field(
        default=None, gt=0, description="Monto a pagar en esta operación (parcial o saldo completo)")


class CommissionPaymentCancel(BaseModel):
    cancellation_reason: str = Field(..., min_length=3, max_length=500)


class CommissionPaymentOut(BaseModel):
    id: int
    payment_type: str
    advisor_id: int | None = None
    project_id: int | None = None
    contract_id: int | None = None
    contract_number: str | None = None
    project_name: str | None = None
    percent_applied: float | None = None
    base_amount: float | None = None
    amount: float
    amount_paid: float = 0
    balance: float = 0
    origin: str = "manual"
    concept: str
    payment_period: str | None = None
    advisor_name: str
    advisor_is_external: bool = False
    document_type: str
    document_number: str
    bank_name: str
    account_number: str
    payment_status: str
    payment_date: str | None = None
    payment_method: str | None = None
    transaction_number: str | None = None
    notes: str | None = None
    cancelled_at: str | None = None
    cancellation_reason: str | None = None
    created_at: str | None = None
    updated_at: str | None = None

    model_config = ConfigDict(from_attributes=True)


class CommissionStatusCount(BaseModel):
    status: str
    count: int
    total: float


class CommissionSummary(BaseModel):
    pending: float
    pending_count: int
    paid: float
    paid_count: int
    cancelled: float
    cancelled_count: int