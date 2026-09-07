"""
API Routes para Cuotas (installments) del módulo de Cobranzas.
"""
from datetime import date as _date_util
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.domain.models import User
from app.domain.owners_models import (
    Contract,
    FinancingPlan,
    Installment,
    Owner,
    PaymentAllocation,
)
from app.schemas.owners import InstallmentDetail, InstallmentResponse

router = APIRouter(prefix="/installments", tags=["installments"])


@router.get("/", response_model=List[InstallmentResponse])
def list_installments(
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=2000),
    status_filter: Optional[str] = Query(None, alias="status"),
    contract_id: Optional[int] = Query(None),
    owner_id: Optional[int] = Query(None),
    overdue: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Listar cuotas con filtros (estado, contrato, propietario, vencidas)."""
    query = db.query(Installment).join(
        FinancingPlan, FinancingPlan.id == Installment.financing_plan_id
    ).join(
        Contract, Contract.id == FinancingPlan.contract_id
    )

    if status_filter:
        query = query.filter(Installment.status == status_filter)

    if contract_id:
        query = query.filter(FinancingPlan.contract_id == contract_id)

    if owner_id:
        query = query.filter(Contract.owner_id == owner_id)

    if overdue is True:
        today = _date_util.today()
        query = query.filter(
            Installment.status.in_(["pendiente", "parcial", "vencida"]),
            Installment.due_date < today,
        )
    elif overdue is False:
        today = _date_util.today()
        query = query.filter(
            or_(
                Installment.status == "pagada",
                Installment.due_date >= today,
            )
        )

    installments = (
        query.order_by(Installment.due_date.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return installments


@router.get("/{installment_id}", response_model=InstallmentDetail)
def get_installment(
    installment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Obtener detalle de una cuota con los pagos aplicados."""
    installment = db.query(Installment).filter(
        Installment.id == installment_id
    ).first()

    if not installment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cuota no encontrada"
        )

    financing = db.query(FinancingPlan).filter(
        FinancingPlan.id == installment.financing_plan_id
    ).first()
    contract = db.query(Contract).filter(
        Contract.id == financing.contract_id
    ).first()
    owner = db.query(Owner).filter(Owner.id == contract.owner_id).first()

    owner_name = (
        " ".join(p for p in (owner.first_name, owner.paternal_surname) if p)
        if owner and owner.person_type == "natural"
        else owner.business_name if owner else ""
    )

    allocations = db.query(PaymentAllocation).filter(
        PaymentAllocation.installment_id == installment_id
    ).all()

    return {
        **installment.__dict__,
        "contract_number": contract.contract_number,
        "owner_name": owner_name,
        "payments_applied": [
            {
                "payment_id": a.payment_id,
                "amount": float(a.allocated_amount),
                "payment_date": a.payment.payment_date.isoformat()
                if a.payment else None,
                "payment_method": a.payment.payment_method
                if a.payment else None,
            }
            for a in allocations
        ],
    }