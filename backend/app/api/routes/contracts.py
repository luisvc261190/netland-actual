"""
API Routes para Contratos
"""
import tempfile
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.pricing import compute_payment_plan, lot_gross_price
from app.domain.models import SiteConfig, User
from app.domain.owners_models import (
    Contract,
    ContractDocument,
    FinancingPlan,
    Installment,
)
from app.infrastructure.cloudinary_service import upload_file
from app.infrastructure.owners_service import ContractsService, FinancingService
from app.infrastructure.pdf_service import (
    generate_commercial_document_pdf,
    generate_contract_pdf,
    generate_payment_schedule_pdf,
)
from app.schemas.owners import (
    ContractCreate,
    ContractUpdate,
    ContractResponse,
    ContractDetail,
    CashPaymentCreate,
    CashPaymentResponse,
    FinancingPlanCreate,
    FinancingPlanResponse,
    FinancingPlanDetail,
    ContractDocumentCreate,
    ContractDocumentResponse,
)

router = APIRouter(prefix="/contracts", tags=["contracts"])


def _store_pdf(pdf_bytes: bytes, folder: str) -> tuple[str | None, str | None]:
    """Guarda un PDF en Cloudinary si está configurado. Devuelve (url, public_id)."""
    if not settings.is_cloudinary_configured:
        return None, None
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(pdf_bytes)
        tmp_path = tmp.name
    try:
        result = upload_file(tmp_path, folder=folder, resource_type="raw")
        return result.get("url"), result.get("public_id")
    finally:
        Path(tmp_path).unlink(missing_ok=True)


def _document_series(document_type: str) -> str:
    """Prefijo de serie según el tipo de documento."""
    return {
        "factura": "F001",
        "boleta": "B001",
        "proforma": "PROF",
    }.get(document_type, "DOC")


def _company_config(db: Session) -> dict:
    """Datos de empresa configurables desde Configuración (con valores por defecto)."""
    config = {
        c.key: c.value
        for c in db.query(SiteConfig).filter(
            SiteConfig.key.in_(
                [
                    "company_ruc",
                    "company_razon_social",
                    "company_address",
                    "company_bank_accounts",
                ]
            )
        ).all()
    }
    accounts = [
        line.strip()
        for line in (config.get("company_bank_accounts") or "").splitlines()
        if line.strip()
    ]
    return {
        "company_ruc": config.get("company_ruc") or settings.COMPANY_RUC,
        "company_razon_social": config.get("company_razon_social")
        or "NETLAND CORPORACION INMOBILIARIA S.A.C.",
        "company_address": config.get("company_address")
        or settings.COMPANY_ADDRESS,
        "company_accounts": accounts,
    }


@router.post("/", response_model=ContractResponse, status_code=status.HTTP_201_CREATED)
def create_contract(
    contract_data: ContractCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Crear nuevo contrato con opción de vouchers iniciales"""
    from app.infrastructure.cloudinary_service import upload_file
    from app.domain.owners_models import Payment
    import tempfile
    from pathlib import Path
    import base64
    
    data_dict = contract_data.dict(exclude={"co_owners", "initial_vouchers"})
    
    contract = ContractsService.create_contract(
        db,
        data_dict,
        co_owners=contract_data.co_owners,
        user_id=current_user.id
    )
    
    # Procesar vouchers iniciales si existen
    if contract_data.initial_vouchers:
        for voucher_data in contract_data.initial_vouchers:
            # Crear registro de pago
            payment = Payment(
                contract_id=contract.id,
                payer_id=contract.owner_id,
                payment_date=voucher_data.payment_date,
                amount=voucher_data.amount,
                payment_method="transferencia",  # Asumimos transferencia si hay voucher
                notes="Pago inicial - Voucher subido al crear contrato",
                created_by=current_user.id
            )
            
            # Si hay archivo en base64, subirlo a Cloudinary
            if voucher_data.file_data and settings.is_cloudinary_configured:
                try:
                    # Decodificar base64 y guardar temporalmente
                    file_content = base64.b64decode(voucher_data.file_data.split(",")[1] if "," in voucher_data.file_data else voucher_data.file_data)
                    
                    with tempfile.NamedTemporaryFile(delete=False, suffix=Path(voucher_data.file_name or "voucher.jpg").suffix) as tmp:
                        tmp.write(file_content)
                        tmp_path = tmp.name
                    
                    try:
                        result = upload_file(
                            tmp_path,
                            folder=f"vouchers/contract_{contract.id}",
                            resource_type="auto"
                        )
                        payment.receipt_url = result.get("url")
                        payment.receipt_public_id = result.get("public_id")
                    finally:
                        Path(tmp_path).unlink(missing_ok=True)
                except Exception as e:
                    # Si falla la subida, continuamos sin el voucher
                    print(f"Error uploading voucher: {e}")
            
            db.add(payment)
        
        db.commit()
    
    db.refresh(contract)
    return contract


@router.get("/", response_model=List[ContractResponse])
def list_contracts(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    project_id: Optional[int] = Query(None),
    owner_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    payment_modality: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Listar contratos"""
    query = db.query(Contract)
    
    if project_id:
        query = query.filter(Contract.project_id == project_id)
    
    if owner_id:
        query = query.filter(Contract.owner_id == owner_id)
    
    if status:
        query = query.filter(Contract.status == status)
    
    if payment_modality:
        query = query.filter(Contract.payment_modality == payment_modality)
    
    if search:
        search_term = f"%{search}%"
        query = query.filter(Contract.contract_number.ilike(search_term))
    
    contracts = query.order_by(Contract.created_at.desc()).offset(skip).limit(limit).all()
    return contracts


@router.get("/{contract_id}", response_model=ContractDetail)
def get_contract(
    contract_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Obtener detalle completo del contrato"""
    detail = ContractsService.get_contract_detail(db, contract_id)
    if not detail:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contrato no encontrado"
        )
    
    contract = detail["contract"]
    return {
        **contract.__dict__,
        **detail
    }


@router.put("/{contract_id}", response_model=ContractResponse)
def update_contract(
    contract_id: int,
    contract_data: ContractUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Actualizar contrato"""
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contrato no encontrado"
        )
    
    update_data = contract_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(contract, field, value)
    
    contract.updated_by = current_user.id
    
    db.commit()
    db.refresh(contract)
    return contract


@router.delete("/{contract_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_contract(
    contract_id: int,
    cancellation_reason: str = Query(..., min_length=10),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Anular contrato (cambiar estado a anulado y liberar lote).
    Incluye validaciones de pagos y financiamiento.
    """
    from app.domain.owners_models import Payment, FinancingPlan, Installment
    from sqlalchemy import func
    
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contrato no encontrado"
        )
    
    # Validar que no esté ya anulado
    if contract.status == "anulado":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El contrato ya está anulado"
        )
    
    # Verificar pagos registrados
    total_payments = db.query(func.count(Payment.id)).filter(
        Payment.contract_id == contract_id,
        Payment.is_cancelled == False
    ).scalar()
    
    total_amount_paid = db.query(func.sum(Payment.amount)).filter(
        Payment.contract_id == contract_id,
        Payment.is_cancelled == False
    ).scalar() or 0
    
    # Verificar financiamiento activo
    financing = db.query(FinancingPlan).filter(
        FinancingPlan.contract_id == contract_id
    ).first()
    
    pending_installments = 0
    if financing:
        pending_installments = db.query(func.count(Installment.id)).filter(
            Installment.financing_plan_id == financing.id,
            Installment.status.in_(["pendiente", "vencida", "parcial"])
        ).scalar()
    
    # Información para el log (no bloqueante, solo informativo)
    warnings = []
    if total_payments > 0:
        warnings.append(f"Tiene {total_payments} pago(s) registrado(s) por un total de S/ {float(total_amount_paid):,.2f}")
    if pending_installments > 0:
        warnings.append(f"Tiene {pending_installments} cuota(s) pendiente(s) de pago")
    
    # Anular el contrato
    contract.status = "anulado"
    contract.notes = (contract.notes or "") + f"\n\n[ANULADO] Motivo: {cancellation_reason}"
    contract.updated_by = current_user.id
    
    # Liberar el lote
    from app.domain.models import Lot
    lot = db.query(Lot).filter(Lot.id == contract.lot_id).first()
    if lot:
        lot.status = "available"
    
    # Anular pagos activos asociados (para mantener consistencia)
    db.query(Payment).filter(
        Payment.contract_id == contract_id,
        Payment.is_cancelled == False
    ).update({
        "is_cancelled": True,
        "cancelled_at": func.now(),
        "cancellation_reason": f"Contrato anulado: {cancellation_reason}",
        "cancelled_by": current_user.id
    })
    
    db.commit()
    return None


@router.get("/{contract_id}/cancellation-info", response_model=dict)
def get_cancellation_info(
    contract_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Obtener información sobre el impacto de anular un contrato"""
    from app.domain.owners_models import Payment, FinancingPlan, Installment
    from sqlalchemy import func
    
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contrato no encontrado"
        )
    
    # Contar pagos activos
    total_payments = db.query(func.count(Payment.id)).filter(
        Payment.contract_id == contract_id,
        Payment.is_cancelled == False
    ).scalar()
    
    total_amount_paid = db.query(func.sum(Payment.amount)).filter(
        Payment.contract_id == contract_id,
        Payment.is_cancelled == False
    ).scalar() or 0
    
    # Verificar financiamiento
    financing = db.query(FinancingPlan).filter(
        FinancingPlan.contract_id == contract_id
    ).first()
    
    pending_installments = 0
    paid_installments = 0
    if financing:
        pending_installments = db.query(func.count(Installment.id)).filter(
            Installment.financing_plan_id == financing.id,
            Installment.status.in_(["pendiente", "vencida", "parcial"])
        ).scalar()
        
        paid_installments = db.query(func.count(Installment.id)).filter(
            Installment.financing_plan_id == financing.id,
            Installment.status == "pagada"
        ).scalar()
    
    # Contar documentos
    from app.domain.owners_models import ContractDocument
    total_documents = db.query(func.count(ContractDocument.id)).filter(
        ContractDocument.contract_id == contract_id
    ).scalar()
    
    return {
        "contract_number": contract.contract_number,
        "contract_status": contract.status,
        "can_cancel": contract.status != "anulado",
        "total_payments": total_payments,
        "total_amount_paid": float(total_amount_paid),
        "has_financing": financing is not None,
        "pending_installments": pending_installments,
        "paid_installments": paid_installments,
        "total_documents": total_documents,
        "warnings": [
            f"Este contrato tiene {total_payments} pago(s) registrado(s)" if total_payments > 0 else None,
            f"Monto total pagado: S/ {float(total_amount_paid):,.2f}" if total_amount_paid > 0 else None,
            f"{pending_installments} cuota(s) pendiente(s) serán canceladas" if pending_installments > 0 else None,
            f"{paid_installments} cuota(s) ya pagada(s)" if paid_installments > 0 else None,
            f"{total_documents} documento(s) asociado(s)" if total_documents > 0 else None,
            "El lote volverá a estar disponible para la venta",
            "Los pagos registrados serán marcados como anulados",
        ]
    }


# ============================================================================
# PAGO AL CONTADO
# ============================================================================

@router.post("/{contract_id}/cash-payment", response_model=CashPaymentResponse)
def create_cash_payment(
    contract_id: int,
    cash_data: CashPaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Crear información de pago al contado"""
    from app.domain.owners_models import CashPayment
    
    # Verificar que el contrato existe y es al contado
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contrato no encontrado"
        )
    
    if contract.payment_modality != "contado":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El contrato no es de modalidad al contado"
        )
    
    # Verificar que no existe ya un pago al contado
    existing = db.query(CashPayment).filter(
        CashPayment.contract_id == contract_id
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ya existe información de pago al contado para este contrato"
        )
    
    cash_payment = CashPayment(**cash_data.dict())
    db.add(cash_payment)
    db.commit()
    db.refresh(cash_payment)
    return cash_payment


# ============================================================================
# FINANCIAMIENTO
# ============================================================================

@router.post("/{contract_id}/financing", response_model=FinancingPlanResponse)
def create_financing_plan(
    contract_id: int,
    financing_data: FinancingPlanCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Crear plan de financiamiento"""
    # Verificar que el contrato existe y es financiado
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contrato no encontrado"
        )
    
    if contract.payment_modality != "financiado":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El contrato no es de modalidad financiada"
        )
    
    # Verificar que no existe ya un plan
    from app.domain.owners_models import FinancingPlan
    existing = db.query(FinancingPlan).filter(
        FinancingPlan.contract_id == contract_id
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ya existe un plan de financiamiento para este contrato"
        )
    
    data_dict = financing_data.dict(exclude={"generate_schedule"})
    
    if financing_data.generate_schedule:
        financing = FinancingService.create_financing_with_schedule(
            db, data_dict, user_id=current_user.id
        )
    else:
        from app.domain.owners_models import FinancingPlan
        financing = FinancingPlan(**data_dict)
        financing.outstanding_balance = financing.financed_amount
        db.add(financing)
        db.commit()
        db.refresh(financing)
    
    return financing


@router.get("/{contract_id}/financing", response_model=FinancingPlanDetail)
def get_financing_plan(
    contract_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Obtener plan de financiamiento del contrato"""
    from app.domain.owners_models import FinancingPlan, Installment
    from sqlalchemy import func
    from datetime import date
    
    financing = db.query(FinancingPlan).filter(
        FinancingPlan.contract_id == contract_id
    ).first()
    
    if not financing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plan de financiamiento no encontrado"
        )
    
    # Contar cuotas
    installments_paid = db.query(func.count(Installment.id)).filter(
        Installment.financing_plan_id == financing.id,
        Installment.status == "pagada"
    ).scalar()
    
    installments_pending = db.query(func.count(Installment.id)).filter(
        Installment.financing_plan_id == financing.id,
        Installment.status.in_(["pendiente", "parcial"])
    ).scalar()
    
    installments_overdue = db.query(func.count(Installment.id)).filter(
        Installment.financing_plan_id == financing.id,
        Installment.status == "vencida"
    ).scalar()
    
    # Total pagado
    total_paid = financing.financed_amount - financing.outstanding_balance
    
    # Deuda vencida
    overdue_installments = db.query(Installment).filter(
        Installment.financing_plan_id == financing.id,
        Installment.status == "vencida"
    ).all()
    overdue_amount = sum(i.balance for i in overdue_installments)
    
    # Próximo vencimiento
    next_installment = db.query(Installment).filter(
        Installment.financing_plan_id == financing.id,
        Installment.status.in_(["pendiente", "parcial"])
    ).order_by(Installment.due_date).first()
    
    return {
        **financing.__dict__,
        "installments_paid": installments_paid,
        "installments_pending": installments_pending,
        "installments_overdue": installments_overdue,
        "total_paid": float(total_paid),
        "overdue_amount": float(overdue_amount),
        "next_due_date": next_installment.due_date if next_installment else None
    }


@router.get("/{contract_id}/schedule", response_model=List[dict])
def get_payment_schedule(
    contract_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Obtener cronograma de pagos"""
    from app.domain.owners_models import FinancingPlan, Installment
    
    financing = db.query(FinancingPlan).filter(
        FinancingPlan.contract_id == contract_id
    ).first()
    
    if not financing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plan de financiamiento no encontrado"
        )
    
    installments = db.query(Installment).filter(
        Installment.financing_plan_id == financing.id
    ).order_by(Installment.installment_number).all()
    
    return [
        {
            "id": i.id,
            "installment_number": i.installment_number,
            "due_date": i.due_date.isoformat(),
            "scheduled_amount": float(i.scheduled_amount),
            "paid_amount": float(i.paid_amount),
            "balance": float(i.balance),
            "status": i.status,
            "payment_date": i.payment_date.isoformat() if i.payment_date else None,
            "days_overdue": i.days_overdue
        }
        for i in installments
    ]


@router.post("/{contract_id}/generate-schedule", response_model=dict)
def generate_payment_schedule(
    contract_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Generar cronograma de pagos para un contrato existente"""
    from app.domain.owners_models import FinancingPlan, Installment
    
    financing = db.query(FinancingPlan).filter(
        FinancingPlan.contract_id == contract_id
    ).first()
    
    if not financing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plan de financiamiento no encontrado"
        )
    
    # Verificar que no existan cuotas
    existing_installments = db.query(Installment).filter(
        Installment.financing_plan_id == financing.id
    ).count()
    
    if existing_installments > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ya existen {existing_installments} cuotas generadas"
        )
    
    # Generar cronograma
    FinancingService.generate_installment_schedule(
        db,
        financing.id,
        financing.first_installment_date,
        financing.number_of_installments,
        financing.installment_amount,
        financing.frequency
    )
    
    db.commit()
    
    return {
        "message": "Cronograma generado exitosamente",
        "installments_created": financing.number_of_installments
    }


# ============================================================================
# PDF DEL CONTRATO
# ============================================================================

@router.get("/{contract_id}/pdf")
def get_contract_pdf(
    contract_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Genera y descarga el contrato de compraventa en PDF."""
    from app.domain.owners_models import Owner, Payment
    
    detail = ContractsService.get_contract_detail(db, contract_id)
    if not detail:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contrato no encontrado",
        )

    contract = detail["contract"]
    
    # Obtener datos adicionales del propietario
    owner = db.query(Owner).filter(Owner.id == contract.owner_id).first()
    owner_address = owner.address if owner else None
    
    # Determinar estado civil si es persona natural
    owner_civil_status = None
    if owner and owner.person_type == "natural":
        owner_civil_status = "soltero(a)"  # Default, puede ser extendido en el modelo Owner
    
    # Preparar información de plan de pago
    financing = detail.get("financing")
    payment_plan = None
    if contract.payment_modality == "financiado" and financing:
        payment_plan = {
            "initial_payment": float(financing.get("initial_payment", 0)),
            "financed_amount": float(financing.get("financed_amount", 0)),
            "installments": int(financing.get("number_of_installments", 0)),
            "installment_value": float(financing.get("installment_amount", 0)),
        }
    
    # Obtener vouchers del pago inicial
    initial_vouchers = []
    if contract.payment_modality == "financiado":
        vouchers = db.query(Payment).filter(
            Payment.contract_id == contract_id,
            Payment.notes.like("%Pago inicial - Voucher subido al crear contrato%"),
            Payment.is_cancelled == False,
            Payment.receipt_url != None
        ).all()
        
        initial_vouchers = [
            {
                "amount": float(v.amount),
                "date": v.payment_date.strftime("%d/%m/%Y") if v.payment_date else "",
                "method": v.payment_method or "",
                "transaction": v.transaction_number or "",
                "bank": v.bank_name or "",
                "image_url": v.receipt_url,
            }
            for v in vouchers
        ]
    
    pdf = generate_contract_pdf(
        contract_number=contract.contract_number,
        company_name=settings.COMPANY_NAME,
        company_ruc=settings.COMPANY_RUC,
        company_address=settings.COMPANY_ADDRESS,
        owner_name=detail["owner_name"],
        owner_document=detail["owner_document"],
        owner_address=owner_address,
        owner_civil_status=owner_civil_status,
        project_name=detail["project_name"],
        block_code=detail["block_code"],
        lot_code=detail["lot_code"],
        lot_area_m2=float(contract.lot_area_m2),
        price_per_m2=float(contract.price_per_m2),
        total_price=float(contract.total_price),
        contract_date=contract.contract_date.isoformat(),
        start_date=contract.start_date.isoformat(),
        payment_modality=contract.payment_modality,
        payment_plan=payment_plan,
        advisor_name=detail["advisor_name"],
        notes=contract.notes,
        initial_vouchers=initial_vouchers,
    )

    # Persistir la URL si Cloudinary está disponible
    file_url, public_id = _store_pdf(pdf, folder="contracts")
    if file_url:
        if not contract.contract_pdf_url:
            contract.contract_pdf_url = file_url
            contract.contract_pdf_public_id = public_id
            contract.updated_by = current_user.id
            db.commit()

        # Almacenar la URL en el lote para servirla directamente en futuras descargas
        lot = contract.lot
        if lot is not None and not lot.contract_pdf_url:
            lot.contract_pdf_url = file_url
            db.commit()

    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{contract.contract_number}.pdf"',
            "Cache-Control": "no-store",
        },
    )


# ============================================================================
# DOCUMENTOS DE VENTA (PROFORMA / BOLETA / FACTURA)
# ============================================================================

@router.get("/{contract_id}/documents", response_model=List[ContractDocumentResponse])
def list_contract_documents(
    contract_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lista los documentos emitidos para un contrato."""
    return (
        db.query(ContractDocument)
        .filter(ContractDocument.contract_id == contract_id)
        .order_by(ContractDocument.uploaded_at.desc())
        .all()
    )


@router.post(
    "/{contract_id}/emit-document",
    status_code=status.HTTP_201_CREATED,
)
def emit_contract_document(
    contract_id: int,
    doc_data: ContractDocumentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Emite un documento comercial (proforma, boleta o factura) y lo descarga en PDF."""
    if doc_data.document_type not in ("proforma", "boleta", "factura"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="document_type debe ser proforma, boleta o factura",
        )

    detail = ContractsService.get_contract_detail(db, contract_id)
    if not detail:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contrato no encontrado",
        )

    contract = detail["contract"]
    financing = detail.get("financing") or {}
    payment_type = "credit" if contract.payment_modality == "financiado" else "cash"

    # Pricing del documento (mismo motor que las cotizaciones)
    esq = float(contract.esquina_surcharge or 0)
    frente_parque = float(contract.frente_parque_surcharge or 0)
    frente_pista = float(contract.frente_a_pista_surcharge or 0)
    disc_type = contract.discount_type or "none"
    disc_value = float(contract.discount_value or 0)
    has_pricing = any([
        esq, frente_parque, frente_pista, disc_value > 0, disc_type != "none",
    ])
    if has_pricing:
        base_price = (
            float(contract.price_per_m2) * float(contract.lot_area_m2)
            if contract.price_per_m2 and contract.lot_area_m2
            else 0
        )
        gross_lot_price = lot_gross_price(
            base_price,
            esquina_surcharge=esq,
            frente_parque_surcharge=frente_parque,
            frente_a_pista_surcharge=frente_pista,
        )
    else:
        base_price = float(contract.total_price or 0)
        gross_lot_price = base_price

    plan = compute_payment_plan(
        gross_price=gross_lot_price,
        discount_type=disc_type if has_pricing else "none",
        discount_value=disc_value,
        payment_type=payment_type,
        initial_payment=float(financing.get("initial_payment") or 0),
        installments=int(financing.get("number_of_installments") or 12),
    )

    lot_description = (
        f"Lote {detail['lot_code']} · {detail['project_name']}\n"
        f"Manzana: {detail['block_code'] or '—'} · "
        f"Área: {float(contract.lot_area_m2):,.2f} m²"
    )
    items = [{"description": lot_description, "amount": round(base_price, 2)}]
    if esq > 0:
        items.append({"description": "Recargo lote en esquina", "amount": round(esq, 2)})
    if frente_parque > 0:
        items.append({"description": "Recargo frente a parque", "amount": round(frente_parque, 2)})
    if frente_pista > 0:
        items.append({"description": "Recargo frente a pista", "amount": round(frente_pista, 2)})
    if round(plan["discount_amount"], 2) > 0:
        desc_label = (
            f"Descuento ({float(disc_value):g}%)"
            if disc_type == "percentage"
            else f"Descuento (S/ {float(disc_value):,.2f})"
        )
        items.append({
            "description": desc_label,
            "amount": -round(plan["discount_amount"], 2),
        })

    total_amount = plan["final_price"] if has_pricing else float(contract.total_price or 0)

    payment_plan_info = {
        "modality": "Contado" if payment_type == "cash" else "Financiado",
        "initial_payment": round(plan["initial_payment"], 2),
        "financed_amount": round(plan["financed_amount"], 2),
        "installments": plan["installment_count"],
        "installment_value": round(plan["installment_value"], 2),
    }

    # Número de documento (autogenerado con serie por tipo)
    if doc_data.document_number:
        document_number = doc_data.document_number
    else:
        series = _document_series(doc_data.document_type)
        existing = (
            db.query(ContractDocument)
            .filter(
                ContractDocument.contract_id == contract_id,
                ContractDocument.document_type == doc_data.document_type,
                ContractDocument.document_name.like(f"%{series}-%"),
            )
            .count()
        )
        document_number = f"{series}-{existing + 1:06d}"

    company = _company_config(db)

    pdf = generate_commercial_document_pdf(
        document_type=doc_data.document_type,
        document_number=document_number,
        company_name=settings.COMPANY_NAME,
        company_ruc=company["company_ruc"],
        company_address=company["company_address"],
        company_razon_social=company["company_razon_social"],
        company_accounts=company["company_accounts"],
        company_phone=settings.COMPANY_WHATSAPP,
        customer_name=detail["owner_name"],
        customer_document=detail["owner_document"],
        issue_date=datetime.now().strftime("%d/%m/%Y"),
        items=items,
        total_amount=total_amount,
        note=doc_data.description,
        payment_plan=payment_plan_info,
    )

    file_url, public_id = _store_pdf(pdf, folder="contract_documents")

    document = ContractDocument(
        contract_id=contract_id,
        document_name=f"{doc_data.document_type}-{document_number}",
        document_type=doc_data.document_type,
        description=doc_data.description,
        file_url=file_url,
        file_public_id=public_id,
        file_size=len(pdf),
        uploaded_by=current_user.id,
    )
    db.add(document)
    db.commit()
    db.refresh(document)

    return Response(
        content=pdf,
        media_type="application/pdf",
        status_code=status.HTTP_201_CREATED,
        headers={
            "Content-Disposition": f'attachment; filename="{document_number}.pdf"',
            "Cache-Control": "no-store",
        },
    )


@router.get("/{contract_id}/schedule-pdf")
def generate_contract_schedule_pdf(
    contract_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Genera y descarga el cronograma de pagos del contrato en PDF."""
    detail = ContractsService.get_contract_detail(db, contract_id)
    if not detail:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contrato no encontrado",
        )

    contract = detail["contract"]
    financing = detail.get("financing")

    company = _company_config(db)

    filename = f"cronograma-{contract.contract_number}.pdf"

    if contract.payment_modality != "financiado" or not financing:
        contract_date = contract.contract_date.strftime("%d/%m/%Y") if contract.contract_date else ""
        pdf = generate_payment_schedule_pdf(
            contract_number=contract.contract_number,
            company_name=settings.COMPANY_NAME,
            owner_name=detail["owner_name"],
            owner_document=detail["owner_document"],
            project_name=detail["project_name"],
            block_code=detail["block_code"],
            lot_code=detail["lot_code"],
            contract_date=contract_date,
            payment_modality=contract.payment_modality,
            total_price=float(contract.total_price or 0),
            initial_payment=0,
            financed_amount=0,
            installment_amount=0,
            number_of_installments=0,
            installments=[],
            company_ruc=company["company_ruc"],
            company_razon_social=company["company_razon_social"],
            company_address=company["company_address"],
            company_accounts=company["company_accounts"],
            company_phone=settings.COMPANY_WHATSAPP,
        )
        return Response(
            content=pdf,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Cache-Control": "no-store",
            },
        )

    # Cuotas ordenadas por número
    financing_plan = db.query(FinancingPlan).filter(
        FinancingPlan.contract_id == contract_id
    ).first()
    installments = db.query(Installment).filter(
        Installment.financing_plan_id == financing_plan.id
    ).order_by(Installment.installment_number).all()

    schedule = [{
        "installment_number": i.installment_number,
        "due_date": i.due_date.strftime("%d/%m/%Y") if i.due_date else "",
        "scheduled_amount": float(i.scheduled_amount),
        "paid_amount": float(i.paid_amount),
        "balance": float(i.balance),
        "status": i.status,
    } for i in installments]

    contract_date = contract.contract_date.strftime("%d/%m/%Y") if contract.contract_date else ""

    pdf = generate_payment_schedule_pdf(
        contract_number=contract.contract_number,
        company_name=settings.COMPANY_NAME,
        owner_name=detail["owner_name"],
        owner_document=detail["owner_document"],
        project_name=detail["project_name"],
        block_code=detail["block_code"],
        lot_code=detail["lot_code"],
        contract_date=contract_date,
        payment_modality=contract.payment_modality,
        total_price=float(financing.get("total_price") or contract.total_price or 0),
        initial_payment=float(financing.get("initial_payment") or 0),
        financed_amount=float(financing.get("financed_amount") or 0),
        installment_amount=float(financing.get("installment_amount") or 0),
        number_of_installments=int(financing.get("number_of_installments") or 0),
        installments=schedule,
        company_ruc=company["company_ruc"],
        company_razon_social=company["company_razon_social"],
        company_address=company["company_address"],
        company_accounts=company["company_accounts"],
        company_phone=settings.COMPANY_WHATSAPP,
    )

    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store",
        },
    )
