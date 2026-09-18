"""
API Routes para Pagos
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.domain.models import User
from app.domain.owners_models import Payment
from app.infrastructure.owners_service import PaymentsService
from app.schemas.owners import (
    PaymentCreate,
    PaymentUpdate,
    PaymentCancel,
    PaymentResponse,
    PaymentDetail,
    ContractDocumentCreate,
)

router = APIRouter(prefix="/payments", tags=["payments"])


_PAYMENT_METHOD_LABELS = {
    "efectivo": "Efectivo",
    "transferencia": "Transferencia",
    "deposito": "Depósito",
    "cheque": "Cheque",
    "tarjeta": "Tarjeta",
    "yape": "Yape",
    "plin": "Plin",
    "otro": "Otro",
}


@router.post("/", response_model=PaymentResponse, status_code=status.HTTP_201_CREATED)
def register_payment(
    payment_data: PaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Registrar nuevo pago"""
    data_dict = payment_data.dict(exclude={"allocations", "exonerate_late_interest"})
    
    try:
        payment = PaymentsService.register_payment(
            db,
            data_dict,
            allocations=payment_data.allocations,
            exonerate_late_interest=payment_data.exonerate_late_interest,
            user_id=current_user.id
        )
        return payment
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/late-interest-config", response_model=dict)
def late_interest_config(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Configuración del interés diario por mora (visible para el módulo de cobranzas)."""
    daily = PaymentsService.get_late_interest_daily(db)
    return {"daily_rate": float(daily), "enabled": daily > 0}


@router.get("/", response_model=List[dict])
def list_payments(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    contract_id: Optional[int] = Query(None),
    payer_id: Optional[int] = Query(None),
    payment_method: Optional[str] = Query(None),
    is_cancelled: Optional[bool] = Query(False),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Listar pagos con información de contrato y propietario"""
    from app.domain.owners_models import Owner, Contract
    from sqlalchemy.orm import joinedload
    
    query = db.query(Payment).options(
        joinedload(Payment.payer),
        joinedload(Payment.contract)
    )
    
    if contract_id:
        query = query.filter(Payment.contract_id == contract_id)
    
    if payer_id:
        query = query.filter(Payment.payer_id == payer_id)
    
    if payment_method:
        query = query.filter(Payment.payment_method == payment_method)
    
    if is_cancelled is not None:
        query = query.filter(Payment.is_cancelled == is_cancelled)
    
    if from_date:
        query = query.filter(Payment.payment_date >= from_date)
    
    if to_date:
        query = query.filter(Payment.payment_date <= to_date)
    
    # Búsqueda por texto
    if search:
        search_term = f"%{search}%"
        query = query.join(Payment.contract).join(Payment.payer).filter(
            (Contract.contract_number.ilike(search_term)) |
            (Payment.transaction_number.ilike(search_term)) |
            (Payment.bank_name.ilike(search_term)) |
            (Owner.first_name.ilike(search_term)) |
            (Owner.paternal_surname.ilike(search_term)) |
            (Owner.business_name.ilike(search_term))
        )
    
    payments = query.order_by(Payment.payment_date.desc()).offset(skip).limit(limit).all()
    
    # Formatear respuesta con datos adicionales
    result = []
    for p in payments:
        payer_name = (
            f"{p.payer.first_name} {p.payer.paternal_surname}".strip()
            if p.payer.person_type == "natural"
            else p.payer.business_name
        )
        
        result.append({
            "id": p.id,
            "contract_id": p.contract_id,
            "contract_number": p.contract.contract_number,
            "payer_id": p.payer_id,
            "payer_name": payer_name,
            "payment_date": p.payment_date.isoformat(),
            "amount": float(p.amount),
            "payment_method": p.payment_method,
            "transaction_number": p.transaction_number,
            "bank_name": p.bank_name,
            "notes": p.notes,
            "is_cancelled": p.is_cancelled,
            "cancelled_at": p.cancelled_at.isoformat() if p.cancelled_at else None,
            "cancellation_reason": p.cancellation_reason,
            "receipt_url": p.receipt_url,
            "late_interest_amount": float(p.late_interest_amount),
            "late_interest_days": p.late_interest_days,
            "late_interest_waived": p.late_interest_waived,
            "created_at": p.created_at.isoformat(),
        })
    
    return result


@router.get("/{payment_id}", response_model=PaymentDetail)
def get_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Obtener detalle del pago"""
    from app.domain.owners_models import PaymentAllocation, Owner, Contract
    from sqlalchemy.orm import joinedload
    
    payment = db.query(Payment).options(
        joinedload(Payment.payer).joinedload(Owner.client),
        joinedload(Payment.contract)
    ).filter(Payment.id == payment_id).first()
    
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pago no encontrado"
        )
    
    # Obtener distribución del pago
    allocations = db.query(PaymentAllocation).filter(
        PaymentAllocation.payment_id == payment_id
    ).all()
    
    allocations_data = [
        {
            "installment_id": a.installment_id,
            "installment_number": a.installment.installment_number,
            "allocated_amount": float(a.allocated_amount),
            "due_date": a.installment.due_date.isoformat(),
            "late_days": a.late_days,
            "late_interest": float(a.late_interest)
        }
        for a in allocations
    ]
    
    payer_name = f"{payment.payer.first_name} {payment.payer.paternal_surname}".strip() if payment.payer.person_type == "natural" else payment.payer.business_name
    
    return {
        **payment.__dict__,
        "payer_name": payer_name,
        "contract_number": payment.contract.contract_number,
        "allocations": allocations_data
    }


@router.put("/{payment_id}", response_model=PaymentResponse)
def update_payment(
    payment_id: int,
    payment_data: PaymentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Actualizar pago (solo notas y comprobante)"""
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pago no encontrado"
        )
    
    if payment.is_cancelled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede actualizar un pago anulado"
        )
    
    update_data = payment_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(payment, field, value)
    
    db.commit()
    db.refresh(payment)
    return payment


@router.post("/{payment_id}/cancel", response_model=PaymentResponse)
def cancel_payment(
    payment_id: int,
    cancel_data: PaymentCancel,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Anular pago"""
    try:
        payment = PaymentsService.cancel_payment(
            db,
            payment_id,
            cancel_data.cancellation_reason,
            user_id=current_user.id
        )
        return payment
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/history/{contract_id}", response_model=List[dict])
def get_payment_history(
    contract_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Obtener historial de pagos de un contrato"""
    payments = db.query(Payment).filter(
        Payment.contract_id == contract_id
    ).order_by(Payment.payment_date.desc()).all()
    
    return [
        {
            "id": p.id,
            "payment_date": p.payment_date.isoformat(),
            "amount": float(p.amount),
            "payment_method": p.payment_method,
            "transaction_number": p.transaction_number,
            "is_cancelled": p.is_cancelled,
            "notes": p.notes,
            "late_interest_amount": float(p.late_interest_amount),
            "late_interest_days": p.late_interest_days,
            "late_interest_waived": p.late_interest_waived,
            "created_at": p.created_at.isoformat()
        }
        for p in payments
    ]


@router.post("/{payment_id}/emit-document", status_code=status.HTTP_201_CREATED)
def emit_payment_document(
    payment_id: int,
    doc_data: ContractDocumentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Emite la proforma, boleta o factura de un pago específico y la descarga en PDF."""
    from datetime import datetime

    from sqlalchemy.orm import joinedload

    from app.api.routes.contracts import (
        _company_config,
        _document_series,
        _store_pdf,
    )
    from app.domain.owners_models import (
        Contract,
        ContractDocument,
        PaymentAllocation,
    )
    from app.infrastructure.owners_service import ContractsService
    from app.infrastructure.pdf_service import generate_commercial_document_pdf

    if doc_data.document_type not in ("proforma", "boleta", "factura"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="document_type debe ser proforma, boleta o factura",
        )

    payment = (
        db.query(Payment)
        .options(
            joinedload(Payment.payer),
            joinedload(Payment.contract).joinedload(Contract.project),
        )
        .filter(Payment.id == payment_id)
        .first()
    )
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pago no encontrado",
        )
    if payment.is_cancelled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede emitir un documento de un pago anulado",
        )

    contract = payment.contract
    detail = ContractsService.get_contract_detail(db, payment.contract_id)
    payer = payment.payer

    customer_name = (
        f"{payer.first_name} {payer.paternal_surname}".strip()
        if payer.person_type == "natural"
        else (payer.business_name or "")
    )
    customer_document = f"{payer.document_type} {payer.document_number}".strip()

    # Ítems del documento a partir de la aplicación del pago a cuotas
    allocations = (
        db.query(PaymentAllocation)
        .filter(PaymentAllocation.payment_id == payment_id)
        .order_by(PaymentAllocation.installment_id)
        .all()
    )

    lot_description = (
        f"Lote {detail['lot_code']} · {detail['project_name']}"
        + (f"\nManzana: {detail['block_code'] or '—'} · Área: {float(contract.lot_area_m2):,.2f} m²" if contract.lot_area_m2 else "")
    )

    mora = float(payment.late_interest_amount or 0)
    has_mora = mora > 0 and not payment.late_interest_waived

    items = []
    if allocations:
        for alloc in allocations:
            items.append({
                "description": (
                    f"Cuota {alloc.installment.installment_number:02d} · "
                    f"vencimiento {alloc.installment.due_date.strftime('%d/%m/%Y')}"
                ),
                "amount": round(float(alloc.allocated_amount), 2),
            })
        if has_mora:
            days = payment.late_interest_days or 0
            items.append({
                "description": (
                    f"Interés por mora ({days} día{'s' if days != 1 else ''})"
                ),
                "amount": round(mora, 2),
            })
    else:
        items.append({
            "description": lot_description,
            "amount": round(float(payment.amount or 0), 2),
        })

    total_amount = float(payment.amount or 0)

    # Número de documento (serie por tipo, continuando la numeración del contrato)
    if doc_data.document_number:
        document_number = doc_data.document_number
    else:
        series = _document_series(doc_data.document_type)
        existing = (
            db.query(ContractDocument)
            .filter(
                ContractDocument.contract_id == payment.contract_id,
                ContractDocument.document_type == doc_data.document_type,
                ContractDocument.document_name.like(f"%{series}-%"),
            )
            .count()
        )
        document_number = f"{series}-{existing + 1:06d}"

    company = _company_config(db)

    # Incluir la cuenta bancaria del proyecto en el encabezado del documento
    accounts = list(company["company_accounts"])
    project = contract.project
    if project:
        if project.bank_accounts:
            for acc in project.bank_accounts:
                bank = (acc.get("bank") if isinstance(acc, dict) else getattr(acc, "bank", "")) or ""
                account_number = (acc.get("account_number") if isinstance(acc, dict) else getattr(acc, "account_number", "")) or ""
                if bank and account_number:
                    accounts.append(f"{bank} - N° {account_number}")
                elif account_number:
                    accounts.append(f"N° de cuenta {account_number}")
                elif bank:
                    accounts.append(bank)
        elif project.bank_name or project.bank_account_number:
            if project.bank_name and project.bank_account_number:
                accounts.append(f"{project.bank_name} - N° {project.bank_account_number}")
            elif project.bank_account_number:
                accounts.append(f"N° de cuenta {project.bank_account_number}")
            else:
                accounts.append(project.bank_name)

    payment_date = payment.payment_date.strftime("%d/%m/%Y")
    method_label = _PAYMENT_METHOD_LABELS.get(
        payment.payment_method, str(payment.payment_method).capitalize()
    )
    note_lines = [f"Pago #{payment.id} del {payment_date} · {method_label}"]
    if payment.transaction_number:
        prefix = (payment.bank_name or "Banco").strip()
        note_lines.append(f"{prefix} · Transacción {payment.transaction_number}")
    if has_mora:
        days = payment.late_interest_days or 0
        note_lines.append(
            f"Incluye interés de mora por {days} día{'s' if days != 1 else ''}: S/ {mora:,.2f}"
        )
    elif payment.late_interest_waived and (payment.late_interest_days or 0) > 0:
        days = payment.late_interest_days or 0
        note_lines.append(f"Mora exonerada ({days} día{'s' if days != 1 else ''}) — sin recargo")
    if doc_data.description:
        note_lines.append(doc_data.description)
    note = "\n".join(note_lines[:3])

    pdf = generate_commercial_document_pdf(
        document_type=doc_data.document_type,
        document_number=document_number,
        company_name=settings.COMPANY_NAME,
        company_ruc=company["company_ruc"],
        company_address=company["company_address"],
        company_razon_social=company["company_razon_social"],
        company_accounts=accounts,
        company_phone=settings.COMPANY_WHATSAPP,
        customer_name=customer_name,
        customer_document=customer_document,
        issue_date=datetime.now().strftime("%d/%m/%Y"),
        items=items,
        total_amount=total_amount,
        note=note,
    )

    file_url, public_id = _store_pdf(pdf, folder="contract_documents")

    document = ContractDocument(
        contract_id=payment.contract_id,
        document_name=f"{doc_data.document_type}-{document_number}",
        document_type=doc_data.document_type,
        description=doc_data.description or f"Documento del pago #{payment.id}",
        file_url=file_url,
        file_public_id=public_id,
        file_size=len(pdf),
        payment_id=payment.id,
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
