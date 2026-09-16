from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class ClientCreate(BaseModel):
    name: str = Field(min_length=2)
    last_name: str = ""
    phone: str = ""
    whatsapp: str = ""
    email: EmailStr | None = None
    notes: str = ""


class ClientOut(BaseModel):
    id: int
    name: str
    last_name: str
    phone: str
    whatsapp: str
    email: EmailStr | None = None
    notes: str

    model_config = ConfigDict(from_attributes=True)

    @field_validator("email", mode="before")
    @classmethod
    def empty_email_to_none(cls, value):
        if value == "" or value is None:
            return None
        return value


class LeadCreate(BaseModel):
    name: str = Field(min_length=2)
    last_name: str = ""
    phone: str = ""
    whatsapp: str = ""
    email: EmailStr | None = None
    project_id: int | None = None
    lot_id: int | None = None
    advisor_id: int | None = None
    budget: float | None = None
    source: str = "web"
    message: str = ""


class LeadUpdate(BaseModel):
    status: str | None = None
    project_id: int | None = None
    lot_id: int | None = None
    advisor_id: int | None = None
    budget: float | None = None
    source: str | None = None
    follow_up: str | None = None
    name: str | None = None
    last_name: str | None = None
    phone: str | None = None
    whatsapp: str | None = None
    email: EmailStr | None = None


class CapturedLeadCreate(BaseModel):
    """Registro manual de clientes captados por asesores (campo / llamada)."""
    name: str = Field(min_length=2)
    last_name: str = ""
    phone: str = Field(min_length=6)
    whatsapp: str = ""
    email: EmailStr | None = None
    project_id: int | None = None
    budget: float | None = None
    source: str = "campo"
    message: str = ""
    follow_up: str = ""
    advisor_id: int | None = None

    @field_validator("source")
    @classmethod
    def normalize_source(cls, value: str) -> str:
        return value.strip().lower()[:60] or "campo"


class LeadOut(BaseModel):
    id: int
    client: ClientOut | None = None
    project_id: int | None = None
    project_name: str | None = None
    lot_id: int | None = None
    lot_code: str | None = None
    advisor_id: int | None = None
    advisor_name: str | None = None
    status: str
    budget: float | None = None
    source: str
    message: str
    follow_up: str
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class VisitCreate(BaseModel):
    lead_id: int
    advisor_id: int | None = None
    project_id: int | None = None
    scheduled_at: Any
    status: str = "pending"
    notes: str = ""


class VisitUpdate(BaseModel):
    scheduled_at: Any = None
    status: str | None = None
    notes: str | None = None


class VisitOut(BaseModel):
    id: int
    lead_id: int
    advisor_id: int | None = None
    project_id: int | None = None
    scheduled_at: datetime | None = None
    status: str
    notes: str
    lead_name: str | None = None
    project_name: str | None = None
    advisor_name: str | None = None

    model_config = ConfigDict(from_attributes=True)


class AdvisorCreate(BaseModel):
    name: str
    role_title: str = "Asesor Inmobiliario"
    photo_url: str = ""
    phone: str = ""
    whatsapp: str = ""
    email: EmailStr | None = None
    project_ids: str = ""
    is_available: bool = True
    bio: str = ""
    sort_order: int = 0
    # Datos de identidad y pago
    document_type: str = "DNI"  # DNI | CE | RUC | PASAPORTE | OTRO
    document_number: str = ""
    bank_name: str = ""
    account_number: str = ""
    is_external: bool = False
    base_salary: float | None = None


class AdvisorUpdate(BaseModel):
    name: str | None = None
    role_title: str | None = None
    photo_url: str | None = None
    phone: str | None = None
    whatsapp: str | None = None
    email: EmailStr | None = None
    project_ids: str | None = None
    is_available: bool | None = None
    bio: str | None = None
    sort_order: int | None = None
    document_type: str | None = None
    document_number: str | None = None
    bank_name: str | None = None
    account_number: str | None = None
    is_external: bool | None = None
    base_salary: float | None = None


class AdvisorOut(BaseModel):
    id: int
    name: str
    role_title: str
    photo_url: str
    phone: str
    whatsapp: str
    email: EmailStr | None = None
    project_ids: str
    is_available: bool
    bio: str
    sort_order: int
    document_type: str
    document_number: str
    bank_name: str
    account_number: str
    is_external: bool
    base_salary: float | None = None
    deleted_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class QuoteCreate(BaseModel):
    lead_id: int | None = None
    advisor_id: int | None = None
    project_id: int
    lot_id: int
    lot_price: float | None = None
    price_per_m2: float | None = None
    esquina_surcharge: float = 0
    frente_parque_surcharge: float = 0
    frente_a_pista_surcharge: float = 0
    discount_type: str = "none"  # none, percentage, fixed
    discount_value: float = 0
    payment_type: str = "credit"  # cash, credit
    initial_payment: float = 0
    installments: int = Field(default=12, ge=0, le=120)
    client_name: str = ""
    client_phone: str = ""
    client_email: str = ""
    notes: str = ""


class QuoteUpdate(BaseModel):
    lead_id: int | None = None
    advisor_id: int | None = None
    project_id: int | None = None
    lot_id: int | None = None
    lot_price: float | None = None
    price_per_m2: float | None = None
    esquina_surcharge: float | None = None
    frente_parque_surcharge: float | None = None
    frente_a_pista_surcharge: float | None = None
    discount_type: str = "none"
    discount_value: float = 0
    payment_type: str = "credit"  # cash, credit
    initial_payment: float = 0
    installments: int = Field(default=12, ge=0, le=120)
    client_name: str = ""
    client_phone: str = ""
    client_email: str = ""
    notes: str = ""


class QuoteOut(BaseModel):
    id: int
    quote_number: str
    lead_id: int | None = None
    advisor_id: int | None = None
    project_id: int | None = None
    lot_id: int | None = None
    lot_price: float | None = None
    price_per_m2: float | None = None
    esquina_surcharge: float | None = None
    frente_parque_surcharge: float | None = None
    frente_a_pista_surcharge: float | None = None
    discount_type: str | None = None
    discount_value: float | None = None
    payment_type: str | None = None
    initial_payment: float | None = None
    installments: int | None = None
    installment_value: float | None = None
    total_amount: float | None = None
    client_name: str | None = None
    client_phone: str | None = None
    client_email: str | None = None
    notes: str | None = None
    status: str
    pdf_url: str
    project_name: str | None = None
    lot_code: str | None = None
    lot_area: float | None = None
    advisor_name: str | None = None

    model_config = ConfigDict(from_attributes=True)


class PublicLeadCreate(BaseModel):
    name: str = Field(min_length=2)
    last_name: str = ""
    phone: str = Field(min_length=6)
    whatsapp: str = ""
    email: EmailStr | None = None
    project_id: int | None = None
    lot_id: int | None = None
    budget: float | None = None
    source: str = "web"
    message: str = ""

    @field_validator("source")
    @classmethod
    def normalize_source(cls, value: str) -> str:
        return value.strip().lower()[:60] or "web"