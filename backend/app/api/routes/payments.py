"""
API Routes para Pagos
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

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
)

router = APIRouter(prefix="/payments", tags=["payments"])


@router.post("/", response_model=PaymentResponse, status_code=status.HTTP_201_CREATED)
def register_payment(
    payment_data: PaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Registrar nuevo pago"""
    data_dict = payment_data.dict(exclude={"allocations"})
    
    try:
        payment = PaymentsService.register_payment(
            db,
            data_dict,
            allocations=payment_data.allocations,
            user_id=current_user.id
        )
        return payment
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


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
            "due_date": a.installment.due_date.isoformat()
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
            "created_at": p.created_at.isoformat()
        }
        for p in payments
    ]
