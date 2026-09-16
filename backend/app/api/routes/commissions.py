"""
API Routes para Comisiones y Planillas de Asesores
"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import require_admin
from app.domain.commission_models import AdvisorCommission, CommissionPayment
from app.domain.models import User
from app.infrastructure.commissions_service import CommissionsService
from app.schemas.commissions import (
    AdvisorCommissionCreate,
    AdvisorCommissionOut,
    AdvisorCommissionUpdate,
    CommissionPaymentCancel,
    CommissionPaymentCreate,
    CommissionPaymentOut,
    CommissionPaymentPay,
    CommissionPaymentUpdate,
)

router = APIRouter(prefix="/commissions", tags=["commissions"])


def _not_found(detail: str = "Registro no encontrado.") -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail)


def _bad_request(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


# ============================================================================
# CONFIGURACIÓN DE PORCENTAJES (asegurador × proyecto)
# ============================================================================


@router.get("/configs", response_model=list[AdvisorCommissionOut])
def list_configs(
    advisor_id: Optional[int] = None,
    project_id: Optional[int] = None,
    is_active: Optional[bool] = None,
    include_deleted: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Lista los porcentajes de comisión por asesor y proyecto."""
    query = db.query(AdvisorCommission)
    if not include_deleted:
        query = query.filter(AdvisorCommission.deleted_at.is_(None))
    if advisor_id:
        query = query.filter(AdvisorCommission.advisor_id == advisor_id)
    if project_id:
        query = query.filter(AdvisorCommission.project_id == project_id)
    if is_active is not None:
        query = query.filter(AdvisorCommission.is_active == is_active)
    rows = query.order_by(AdvisorCommission.created_at.desc()).all()
    return [CommissionsService.serialize_config(r) for r in rows]


@router.post(
    "/configs",
    response_model=AdvisorCommissionOut,
)
def create_config(
    payload: AdvisorCommissionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    try:
        config = CommissionsService.create_config(
            db, payload.model_dump(), user_id=current_user.id
        )
        return CommissionsService.serialize_config(config)
    except ValueError as e:
        raise _bad_request(str(e))


@router.put(
    "/configs/{config_id}",
    response_model=AdvisorCommissionOut,
)
def update_config(
    config_id: int,
    payload: AdvisorCommissionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    try:
        config = CommissionsService.update_config(
            db, config_id, payload.model_dump(exclude_unset=True), user_id=current_user.id
        )
        return CommissionsService.serialize_config(config)
    except ValueError as e:
        raise _bad_request(str(e))


@router.delete(
    "/configs/{config_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_config(
    config_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    try:
        CommissionsService.soft_delete_config(db, config_id)
    except ValueError as e:
        raise _bad_request(str(e))
    return None


@router.post(
    "/configs/{config_id}/reactivate",
    response_model=AdvisorCommissionOut,
)
def reactivate_config(
    config_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    try:
        config = CommissionsService.restore_config(db, config_id)
        return CommissionsService.serialize_config(config)
    except ValueError as e:
        raise _bad_request(str(e))


# ============================================================================
# PAGOS DE COMISIONES Y MENSUALIDADES
# ============================================================================


@router.get("/payments", response_model=list[CommissionPaymentOut])
def list_payments(
    payment_type: Optional[str] = Query(None, description="comision | mensualidad"),
    advisor_id: Optional[int] = None,
    project_id: Optional[int] = None,
    payment_status: Optional[str] = None,
    payment_period: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    search: Optional[str] = None,
    include_deleted: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Lista pagos de comisiones y mensualidades con filtros."""
    query = db.query(CommissionPayment)
    if not include_deleted:
        query = query.filter(CommissionPayment.deleted_at.is_(None))
    if payment_type:
        query = query.filter(CommissionPayment.payment_type == payment_type)
    if advisor_id:
        query = query.filter(CommissionPayment.advisor_id == advisor_id)
    if project_id:
        query = query.filter(CommissionPayment.project_id == project_id)
    if payment_status:
        query = query.filter(CommissionPayment.payment_status == payment_status)
    if payment_period:
        query = query.filter(CommissionPayment.payment_period == payment_period)

    if from_date:
        try:
            from_dt = datetime.fromisoformat(from_date)
        except ValueError:
            raise _bad_request("from_date inválida.")
        query = query.filter(CommissionPayment.created_at >= from_dt)
    if to_date:
        try:
            to_dt = datetime.fromisoformat(to_date)
        except ValueError:
            raise _bad_request("to_date inválida.")
        query = query.filter(CommissionPayment.created_at <= to_dt)

    if search:
        term = f"%{search.strip()}%"
        from sqlalchemy import or_

        query = query.filter(
            or_(
                CommissionPayment.advisor_name.ilike(term),
                CommissionPayment.document_number.ilike(term),
                CommissionPayment.contract_number.ilike(term),
                CommissionPayment.concept.ilike(term),
            )
        )

    rows = query.order_by(CommissionPayment.created_at.desc()).all()
    return [CommissionsService.serialize_payment(r, db) for r in rows]


@router.post("/payments", response_model=CommissionPaymentOut)
def create_payment(
    payload: CommissionPaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Crea un registro de comisión de venta o mensualidad de asesor."""
    try:
        payment = CommissionsService.build_and_create_payment(
            db, payload.model_dump(), user_id=current_user.id
        )
        return CommissionsService.serialize_payment(payment, db)
    except ValueError as e:
        raise _bad_request(str(e))


@router.get("/payments/{payment_id}", response_model=CommissionPaymentOut)
def get_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    payment = db.get(CommissionPayment, payment_id)
    if not payment or payment.deleted_at is not None:
        raise _not_found("Registro de comisión no encontrado.")
    return CommissionsService.serialize_payment(payment, db)


@router.put("/payments/{payment_id}", response_model=CommissionPaymentOut)
def update_payment(
    payment_id: int,
    payload: CommissionPaymentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    try:
        payment = CommissionsService.update_payment(
            db, payment_id, payload.model_dump(exclude_unset=True), user_id=current_user.id
        )
        return CommissionsService.serialize_payment(payment, db)
    except ValueError as e:
        raise _bad_request(str(e))


@router.post(
    "/payments/{payment_id}/pay",
    response_model=CommissionPaymentOut,
)
def pay_payment(
    payment_id: int,
    payload: CommissionPaymentPay,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Registra el pago efectivo de la comisión o mensualidad."""
    try:
        payment = CommissionsService.pay(
            db, payment_id, payload.model_dump(exclude_unset=True), user_id=current_user.id
        )
        return CommissionsService.serialize_payment(payment, db)
    except ValueError as e:
        raise _bad_request(str(e))


@router.post(
    "/payments/{payment_id}/cancel",
    response_model=CommissionPaymentOut,
)
def cancel_payment(
    payment_id: int,
    payload: CommissionPaymentCancel,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Anula un registro de comisión o mensualidad."""
    try:
        payment = CommissionsService.cancel(
            db, payment_id, payload.cancellation_reason, user_id=current_user.id
        )
        return CommissionsService.serialize_payment(payment, db)
    except ValueError as e:
        raise _bad_request(str(e))


@router.post(
    "/payments/{payment_id}/reactivate",
    response_model=CommissionPaymentOut,
)
def reactivate_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Revierte la anulación y vuelve el registro a estado pendiente."""
    try:
        payment = CommissionsService.reactivate(db, payment_id, user_id=current_user.id)
        return CommissionsService.serialize_payment(payment, db)
    except ValueError as e:
        raise _bad_request(str(e))


@router.delete(
    "/payments/{payment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Eliminación lógica: solo registros pendientes."""
    try:
        CommissionsService.soft_delete_payment(db, payment_id)
    except ValueError as e:
        raise _bad_request(str(e))
    return None