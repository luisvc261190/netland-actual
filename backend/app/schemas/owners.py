"""
Schemas Pydantic para el módulo de Propietarios y Cobranzas
"""
from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field, validator


# ============================================================================
# PROPIETARIOS
# ============================================================================

class OwnerBase(BaseModel):
    """Base para propietario"""
    person_type: str = Field(default="natural", description="Tipo de persona: natural | juridica")
    document_type: str = Field(default="DNI", description="Tipo de documento")
    document_number: str = Field(..., min_length=8, max_length=20, description="Número de documento")
    
    # Persona natural
    first_name: Optional[str] = Field(None, max_length=120)
    paternal_surname: Optional[str] = Field(None, max_length=120)
    maternal_surname: Optional[str] = Field(None, max_length=120)
    
    # Persona jurídica
    business_name: Optional[str] = Field(None, max_length=255)
    
    # Contacto adicional
    secondary_phone: Optional[str] = Field(None, max_length=30)
    address: Optional[str] = Field(None, max_length=255)
    district: Optional[str] = None
    province: Optional[str] = None
    department: Optional[str] = None
    
    birth_date: Optional[date] = None
    is_active: bool = True
    notes: Optional[str] = None

    @validator('person_type')
    def validate_person_type(cls, v):
        if v not in ['natural', 'juridica']:
            raise ValueError('person_type debe ser "natural" o "juridica"')
        return v

    @validator('document_type')
    def validate_document_type(cls, v):
        valid_types = ['DNI', 'RUC', 'CE', 'PASAPORTE', 'OTRO']
        if v not in valid_types:
            raise ValueError(f'document_type debe ser uno de: {", ".join(valid_types)}')
        return v


class OwnerCreate(OwnerBase):
    """Schema para crear propietario"""
    client_id: int = Field(..., description="ID del cliente relacionado")


class OwnerUpdate(BaseModel):
    """Schema para actualizar propietario"""
    person_type: Optional[str] = None
    document_type: Optional[str] = None
    document_number: Optional[str] = None
    first_name: Optional[str] = None
    paternal_surname: Optional[str] = None
    maternal_surname: Optional[str] = None
    business_name: Optional[str] = None
    secondary_phone: Optional[str] = None
    address: Optional[str] = None
    district: Optional[str] = None
    province: Optional[str] = None
    department: Optional[str] = None
    birth_date: Optional[date] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None


class OwnerResponse(OwnerBase):
    """Schema de respuesta de propietario"""
    id: int
    client_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class OwnerWithClient(OwnerResponse):
    """Propietario con datos del cliente"""
    client_name: str
    client_phone: str
    client_email: str
    total_properties: int = 0
    total_debt: Decimal = Decimal("0.00")
    overdue_debt: Decimal = Decimal("0.00")


class OwnerDetail(OwnerWithClient):
    """Detalle completo del propietario"""
    total_purchased: Decimal = Decimal("0.00")
    total_paid: Decimal = Decimal("0.00")
    outstanding_balance: Decimal = Decimal("0.00")
    contracts_count: int = 0
    properties: List[dict] = []


# ============================================================================
# COPROPIEDADES
# ============================================================================

class PropertyOwnershipBase(BaseModel):
    """Base para copropiedad"""
    owner_id: int
    lot_id: int
    ownership_percentage: Decimal = Field(default=Decimal("100.00"), ge=0, le=100)
    role: str = Field(default="titular", description="titular | cotitular | copropietario")


class PropertyOwnershipCreate(PropertyOwnershipBase):
    """Crear copropiedad"""
    contract_id: int


class PropertyOwnershipResponse(PropertyOwnershipBase):
    """Respuesta de copropiedad"""
    id: int
    contract_id: int
    created_at: datetime
    
    class Config:
        from_attributes = True


# ============================================================================
# CONTRATOS
# ============================================================================

class ContractBase(BaseModel):
    """Base para contrato"""
    project_id: int
    lot_id: int
    advisor_id: Optional[int] = None
    contract_date: date
    start_date: date
    lot_area_m2: Decimal = Field(..., gt=0)
    price_per_m2: Decimal = Field(..., gt=0)
    total_price: Decimal = Field(..., gt=0)
    payment_modality: str = Field(..., description="contado | financiado")
    status: str = Field(default="activo")
    notes: Optional[str] = None


class InitialVoucherData(BaseModel):
    """Datos de un voucher del pago inicial"""
    amount: Decimal = Field(..., gt=0, description="Monto del voucher")
    payment_date: date = Field(..., description="Fecha del pago")
    file_data: Optional[str] = Field(None, description="Base64 del archivo o URL")
    file_name: Optional[str] = Field(None, description="Nombre del archivo")


class ContractCreate(ContractBase):
    """Crear contrato"""
    owner_id: int
    # Para copropietarios
    co_owners: Optional[List[dict]] = Field(default=None, description="Lista de copropietarios con % y rol")
    # Para vouchers del pago inicial
    initial_vouchers: Optional[List[InitialVoucherData]] = Field(
        default=None, 
        description="Lista de vouchers del pago inicial (separación + abonos)"
    )


class ContractUpdate(BaseModel):
    """Actualizar contrato"""
    advisor_id: Optional[int] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    contract_pdf_url: Optional[str] = None


class ContractResponse(ContractBase):
    """Respuesta de contrato"""
    id: int
    contract_number: str
    owner_id: int
    contract_pdf_url: Optional[str] = None
    lot_pdf_url: Optional[str] = None
    is_imported: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class ContractDetail(ContractResponse):
    """Detalle completo del contrato"""
    owner_name: str
    owner_document: str
    project_name: str
    block_code: Optional[str] = None
    lot_code: str
    advisor_name: Optional[str] = None
    co_owners: List[dict] = []
    cash_payment: Optional[dict] = None
    financing: Optional[dict] = None
    collection_status: str = "al_dia"
    total_paid: Decimal = Decimal("0.00")
    outstanding_balance: Decimal = Decimal("0.00")
    overdue_amount: Decimal = Decimal("0.00")


# ============================================================================
# PAGO AL CONTADO
# ============================================================================

class CashPaymentBase(BaseModel):
    """Base para pago al contado"""
    total_amount: Decimal = Field(..., gt=0)
    amount_paid: Decimal = Field(default=Decimal("0.00"), ge=0)
    balance: Decimal = Field(..., ge=0)
    payment_date: Optional[date] = None
    status: str = Field(default="pendiente")


class CashPaymentCreate(CashPaymentBase):
    """Crear pago al contado"""
    contract_id: int


class CashPaymentUpdate(BaseModel):
    """Actualizar pago al contado"""
    amount_paid: Optional[Decimal] = None
    payment_date: Optional[date] = None
    status: Optional[str] = None


class CashPaymentResponse(CashPaymentBase):
    """Respuesta de pago al contado"""
    id: int
    contract_id: int
    created_at: datetime
    
    class Config:
        from_attributes = True


# ============================================================================
# FINANCIAMIENTO
# ============================================================================

class FinancingPlanBase(BaseModel):
    """Base para plan de financiamiento"""
    total_price: Decimal = Field(..., gt=0)
    initial_payment: Decimal = Field(default=Decimal("0.00"), ge=0)
    financed_amount: Decimal = Field(..., gt=0)
    number_of_installments: int = Field(..., gt=0)
    installment_amount: Decimal = Field(..., gt=0)
    frequency: str = Field(default="mensual")
    first_installment_date: date
    last_installment_date: date
    interest_rate: Optional[Decimal] = Field(default=Decimal("0.00"), ge=0)
    total_interest: Optional[Decimal] = Field(default=Decimal("0.00"), ge=0)


class FinancingPlanCreate(FinancingPlanBase):
    """Crear plan de financiamiento"""
    contract_id: int
    generate_schedule: bool = Field(default=True, description="Generar cronograma automáticamente")


class FinancingPlanResponse(FinancingPlanBase):
    """Respuesta de plan de financiamiento"""
    id: int
    contract_id: int
    outstanding_balance: Decimal
    created_at: datetime
    
    class Config:
        from_attributes = True


class FinancingPlanDetail(FinancingPlanResponse):
    """Detalle del plan de financiamiento"""
    installments_paid: int = 0
    installments_pending: int = 0
    installments_overdue: int = 0
    total_paid: Decimal = Decimal("0.00")
    overdue_amount: Decimal = Decimal("0.00")
    next_due_date: Optional[date] = None


# ============================================================================
# CUOTAS
# ============================================================================

class InstallmentBase(BaseModel):
    """Base para cuota"""
    installment_number: int = Field(..., gt=0)
    due_date: date
    scheduled_amount: Decimal = Field(..., gt=0)
    paid_amount: Decimal = Field(default=Decimal("0.00"), ge=0)
    balance: Decimal = Field(..., ge=0)
    status: str = Field(default="pendiente")
    days_overdue: int = Field(default=0, ge=0)


class InstallmentCreate(InstallmentBase):
    """Crear cuota"""
    financing_plan_id: int


class InstallmentUpdate(BaseModel):
    """Actualizar cuota"""
    status: Optional[str] = None
    payment_date: Optional[date] = None


class InstallmentResponse(InstallmentBase):
    """Respuesta de cuota"""
    id: int
    financing_plan_id: int
    payment_date: Optional[date] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class InstallmentDetail(InstallmentResponse):
    """Detalle de cuota con pagos aplicados"""
    payments_applied: List[dict] = []
    contract_number: str
    owner_name: str


# ============================================================================
# PAGOS
# ============================================================================

class PaymentBase(BaseModel):
    """Base para pago"""
    payment_date: date
    amount: Decimal = Field(..., gt=0)
    payment_method: str = Field(default="efectivo")
    transaction_number: Optional[str] = None
    bank_name: Optional[str] = None
    notes: Optional[str] = None


class PaymentCreate(PaymentBase):
    """Crear pago"""
    contract_id: int
    payer_id: int
    # Distribución del pago
    allocations: Optional[List[dict]] = Field(
        default=None,
        description="Lista de {installment_id, amount} o null para aplicación automática"
    )


class PaymentUpdate(BaseModel):
    """Actualizar pago"""
    notes: Optional[str] = None
    receipt_url: Optional[str] = None


class PaymentCancel(BaseModel):
    """Anular pago"""
    cancellation_reason: str = Field(..., min_length=10)


class PaymentResponse(PaymentBase):
    """Respuesta de pago"""
    id: int
    contract_id: int
    payer_id: int
    receipt_url: Optional[str] = None
    is_cancelled: bool
    cancelled_at: Optional[datetime] = None
    cancellation_reason: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class PaymentDetail(PaymentResponse):
    """Detalle del pago"""
    payer_name: str
    contract_number: str
    allocations: List[dict] = []


# ============================================================================
# VENTAS
# ============================================================================

class SaleItem(BaseModel):
    """Operación de venta (vista comercial sobre un contrato)."""
    sale_id: int
    contract_id: int
    contract_number: str
    sale_date: date
    owner_name: str
    owner_document: str
    owner_phone: str
    project_name: str
    block_code: Optional[str] = None
    lot_code: str
    lot_area_m2: float = 0
    price_per_m2: float = 0
    total_price: Decimal
    payment_modality: str
    sale_status: str
    payment_status: str
    paid_amount: Decimal
    pending_amount: Decimal
    collection_status: str
    lot_pdf_url: Optional[str] = None
    contract_pdf_url: Optional[str] = None

    class Config:
        from_attributes = True


class SaleCreate(BaseModel):
    """Registrar una venta de un terreno desde el módulo de Ventas.

    La operación se hace de forma atómica: crea (o reutiliza) al cliente, al
    propietario titular y el contrato de compraventa, marcando el lote como
    vendido.
    """
    # --- Comprador / cliente ---
    client_id: Optional[int] = Field(
        default=None, description="Cliente existente; si se omite se crea desde los datos de contacto."
    )
    client_phone: Optional[str] = Field(default=None, max_length=30)
    client_whatsapp: Optional[str] = Field(default=None, max_length=30)
    client_email: Optional[str] = None

    # --- Propietario titular (se reutiliza si ya existe por documento) ---
    person_type: str = Field(default="natural", description="natural | juridica")
    document_type: str = Field(default="DNI", description="DNI | RUC | CE | PASAPORTE | OTRO")
    document_number: str = Field(..., min_length=8, max_length=20, description="Número de documento")
    first_name: Optional[str] = Field(default=None, max_length=120)
    paternal_surname: Optional[str] = Field(default=None, max_length=120)
    maternal_surname: Optional[str] = Field(default=None, max_length=120)
    business_name: Optional[str] = Field(default=None, max_length=255)
    secondary_phone: Optional[str] = Field(default=None, max_length=30)

    # --- Lote y contrato ---
    project_id: int
    lot_id: int
    advisor_id: Optional[int] = None
    contract_date: date
    start_date: date
    lot_area_m2: Optional[Decimal] = Field(default=None, gt=0, description="Si se omite, se toma del lote")
    price_per_m2: Optional[Decimal] = Field(default=None, gt=0, description="Si se omite, se calcula")
    total_price: Optional[Decimal] = Field(default=None, gt=0, description="Si se omite, se toma el precio del lote")
    payment_modality: str = Field(default="financiado", description="contado | financiado")
    notes: Optional[str] = None

    # --- Financiamiento (solo aplica a ventas financiadas; replica la lógica de cotizaciones) ---
    initial_payment: Decimal = Field(default=Decimal("0.00"), ge=0, description="Cuota inicial")
    number_of_installments: int = Field(default=12, gt=0, description="Número de cuotas")
    first_installment_date: Optional[date] = Field(
        default=None, description="Primera cuota; por defecto se usa la fecha de inicio"
    )

    # --- Recargos y descuento (misma lógica que las cotizaciones) ---
    esquina_surcharge: Decimal = Field(default=Decimal("0.00"), ge=0, description="Recargo por lote en esquina (S/)")
    frente_parque_surcharge: Decimal = Field(default=Decimal("0.00"), ge=0, description="Recargo por frente a parque (S/)")
    frente_a_pista_surcharge: Decimal = Field(default=Decimal("0.00"), ge=0, description="Recargo por frente a pista (S/)")
    discount_type: str = Field(default="none", description="none | percentage | fixed")
    discount_value: Decimal = Field(default=Decimal("0.00"), ge=0, description="Descuento (% si es percentage, S/ si es fixed)")
    
    # --- Vouchers iniciales (opcional) ---
    initial_vouchers: Optional[List[InitialVoucherData]] = Field(
        default=None, 
        description="Vouchers de pago inicial subidos al crear la venta"
    )

    @validator("person_type")
    def validate_person_type(cls, v):
        if v not in ("natural", "juridica"):
            raise ValueError('person_type debe ser "natural" o "juridica"')
        return v

    @validator("document_type")
    def validate_document_type(cls, v):
        if v not in ("DNI", "RUC", "CE", "PASAPORTE", "OTRO"):
            raise ValueError('document_type debe ser uno de: DNI, RUC, CE, PASAPORTE, OTRO')
        return v

    @validator("payment_modality")
    def validate_payment_modality(cls, v):
        if v not in ("contado", "financiado"):
            raise ValueError('payment_modality debe ser "contado" o "financiado"')
        return v

    @validator("discount_type")
    def validate_discount_type(cls, v):
        if v not in ("none", "percentage", "fixed"):
            raise ValueError('discount_type debe ser "none", "percentage" o "fixed"')
        return v


# ============================================================================
# DOCUMENTOS DEL CONTRATO
# ============================================================================

class ContractDocumentCreate(BaseModel):
    """Emitir/computar un documento de venta (proforma, boleta o factura)."""
    document_type: str = Field(..., description="proforma | boleta | factura")
    document_number: Optional[str] = Field(
        default=None,
        description="Número manual; si no se envía se autogenera (ej. B001-000001)",
    )
    description: Optional[str] = None


class ContractDocumentResponse(BaseModel):
    """Documento asociado a un contrato."""
    id: int
    contract_id: int
    document_name: str
    document_type: str
    description: Optional[str] = None
    file_url: Optional[str] = None
    file_size: Optional[int] = None
    uploaded_at: datetime

    class Config:
        from_attributes = True


# ============================================================================
# COBRANZAS
# ============================================================================

class CollectionDashboard(BaseModel):
    """Dashboard de cobranzas"""
    total_portfolio: Decimal = Decimal("0.00")
    total_collected: Decimal = Decimal("0.00")
    total_pending: Decimal = Decimal("0.00")
    total_overdue: Decimal = Decimal("0.00")
    collections_today: Decimal = Decimal("0.00")
    collections_month: Decimal = Decimal("0.00")
    upcoming_7_days: Decimal = Decimal("0.00")
    overdue_contracts: int = 0
    active_contracts: int = 0


class CollectionItem(BaseModel):
    """Item de cobranza"""
    contract_id: int
    contract_number: str
    owner_name: str
    owner_document: str
    owner_phone: str
    project_name: str
    block_code: Optional[str] = None
    lot_code: str
    payment_modality: str
    current_installment: Optional[int] = None
    next_due_date: Optional[date] = None
    installment_amount: Optional[Decimal] = None
    outstanding_balance: Decimal
    overdue_amount: Decimal
    days_overdue: int
    overdue_installments: int
    collection_status: str
    
    class Config:
        from_attributes = True


class CollectionFilters(BaseModel):
    """Filtros para cobranzas"""
    project_id: Optional[int] = None
    status: Optional[str] = None
    min_overdue_days: Optional[int] = None
    max_overdue_days: Optional[int] = None
    min_debt: Optional[Decimal] = None
    max_debt: Optional[Decimal] = None
    search: Optional[str] = None


# ============================================================================
# IMPORTACIÓN EXCEL
# ============================================================================

class ExcelImportPreview(BaseModel):
    """Preview de importación Excel"""
    file_name: str
    total_rows: int
    valid_rows: int
    rows_with_warnings: int
    rows_with_errors: int
    preview_data: List[dict]
    errors: List[dict]
    warnings: List[dict]


class ExcelImportConfirm(BaseModel):
    """Confirmar importación"""
    file_name: str
    import_type: str = Field(..., description="owners | contracts | payments")
    column_mapping: dict = Field(..., description="Mapeo de columnas Excel -> Sistema")
    skip_errors: bool = Field(default=False)
    update_existing: bool = Field(default=False)


class ExcelImportResponse(BaseModel):
    """Respuesta de importación"""
    batch_id: int
    status: str
    total_rows: int
    successful_rows: int
    failed_rows: int
    errors: List[dict] = []


class ImportBatchResponse(BaseModel):
    """Respuesta de lote de importación"""
    id: int
    import_type: str
    file_name: str
    total_rows: int
    successful_rows: int
    failed_rows: int
    status: str
    imported_at: datetime
    completed_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


# ============================================================================
# REPORTES
# ============================================================================

class PortfolioByProject(BaseModel):
    """Cartera por proyecto"""
    project_id: int
    project_name: str
    total_contracts: int
    contracts_current: int
    contracts_overdue: int
    contracts_cancelled: int
    total_portfolio: Decimal
    total_collected: Decimal
    total_pending: Decimal
    overdue_amount: Decimal


class CollectionByMonth(BaseModel):
    """Cobranza por mes"""
    year: int
    month: int
    month_name: str
    total_collected: Decimal
    total_payments: int
    average_payment: Decimal


class OwnerStatement(BaseModel):
    """Estado de cuenta del propietario"""
    owner_id: int
    owner_name: str
    document_type: str
    document_number: str
    contracts: List[dict]
    total_purchased: Decimal
    total_paid: Decimal
    outstanding_balance: Decimal
    overdue_amount: Decimal
    generated_at: datetime
