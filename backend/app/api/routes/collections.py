"""
API Routes para Cobranzas
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.domain.models import User
from app.infrastructure.owners_service import CollectionsService, FinancingService
from app.schemas.owners import (
    CollectionDashboard,
    CollectionItem,
    CollectionFilters,
    PortfolioByProject,
)

router = APIRouter(prefix="/collections", tags=["collections"])


@router.get("/dashboard", response_model=CollectionDashboard)
def get_collection_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Obtener dashboard de cobranzas"""
    stats = CollectionsService.get_dashboard_stats(db)
    return stats


@router.get("/items", response_model=List[CollectionItem])
def get_collection_items(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    project_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Obtener items para cobranza"""
    filters = {}
    if project_id:
        filters["project_id"] = project_id
    if status:
        filters["status"] = status
    if search:
        filters["search"] = search
    
    items = CollectionsService.get_collection_items(db, filters, skip, limit)
    return items


@router.get("/overdue", response_model=List[CollectionItem])
def get_overdue_contracts(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    min_days: Optional[int] = Query(None, ge=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Obtener contratos con deuda vencida"""
    items = CollectionsService.get_collection_items(db, skip=skip, limit=limit)
    
    # Filtrar solo vencidos
    overdue = [item for item in items if item["collection_status"] == "vencido"]
    
    if min_days:
        overdue = [item for item in overdue if item["days_overdue"] >= min_days]
    
    return overdue


@router.get("/upcoming", response_model=List[dict])
def get_upcoming_installments(
    days: int = Query(7, ge=1, le=90),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Obtener próximos vencimientos"""
    from datetime import date, timedelta
    from app.domain.owners_models import Installment, FinancingPlan, Contract, Owner
    from sqlalchemy.orm import joinedload
    
    today = date.today()
    end_date = today + timedelta(days=days)
    
    installments = db.query(Installment).options(
        joinedload(Installment.financing).joinedload(FinancingPlan.contract).joinedload(Contract.owner).joinedload(Owner.client)
    ).filter(
        Installment.status.in_(["pendiente", "parcial"]),
        Installment.due_date.between(today, end_date)
    ).order_by(Installment.due_date).all()
    
    result = []
    for inst in installments:
        contract = inst.financing.contract
        owner = contract.owner
        owner_name = f"{owner.first_name} {owner.paternal_surname}".strip() if owner.person_type == "natural" else owner.business_name
        
        result.append({
            "installment_id": inst.id,
            "installment_number": inst.installment_number,
            "due_date": inst.due_date.isoformat(),
            "amount": float(inst.scheduled_amount),
            "balance": float(inst.balance),
            "contract_number": contract.contract_number,
            "owner_name": owner_name,
            "owner_phone": owner.client.phone or owner.secondary_phone,
            "project_name": contract.project.short_name,
            "days_until_due": (inst.due_date - today).days
        })
    
    return result


@router.post("/update-overdue", response_model=dict)
def update_overdue_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Actualizar estado de cuotas vencidas (ejecutar diariamente)"""
    FinancingService.update_overdue_status(db)
    return {"message": "Estados de cuotas actualizados"}


@router.get("/portfolio-by-project", response_model=List[PortfolioByProject])
def get_portfolio_by_project(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Obtener cartera por proyecto"""
    from app.domain.models import Project
    from app.domain.owners_models import Contract, FinancingPlan, CashPayment
    from sqlalchemy import func
    from decimal import Decimal
    
    projects = db.query(Project).filter(Project.is_published == True).all()
    
    result = []
    for project in projects:
        # Contar contratos
        total_contracts = db.query(func.count(Contract.id)).filter(
            Contract.project_id == project.id
        ).scalar()
        
        contracts_current = db.query(func.count(Contract.id)).filter(
            Contract.project_id == project.id,
            Contract.status == "activo"
        ).scalar()
        
        contracts_cancelled = db.query(func.count(Contract.id)).filter(
            Contract.project_id == project.id,
            Contract.status.in_(["cancelado", "anulado", "resuelto"])
        ).scalar()
        
        # Calcular montos
        total_portfolio = Decimal("0.00")
        total_collected = Decimal("0.00")
        overdue_amount = Decimal("0.00")
        
        active_contracts = db.query(Contract).filter(
            Contract.project_id == project.id,
            Contract.status == "activo"
        ).all()
        
        contracts_overdue = 0
        
        for contract in active_contracts:
            if contract.payment_modality == "contado":
                cash = db.query(CashPayment).filter(
                    CashPayment.contract_id == contract.id
                ).first()
                if cash:
                    total_portfolio += cash.total_amount
                    total_collected += cash.amount_paid
            else:
                financing = db.query(FinancingPlan).filter(
                    FinancingPlan.contract_id == contract.id
                ).first()
                if financing:
                    total_portfolio += financing.financed_amount
                    total_collected += (financing.financed_amount - financing.outstanding_balance)
                    
                    # Verificar si tiene deuda vencida
                    from app.domain.owners_models import Installment
                    overdue = db.query(func.sum(Installment.balance)).filter(
                        Installment.financing_plan_id == financing.id,
                        Installment.status == "vencida"
                    ).scalar()
                    if overdue and overdue > 0:
                        overdue_amount += overdue
                        contracts_overdue += 1
        
        total_pending = total_portfolio - total_collected
        
        result.append({
            "project_id": project.id,
            "project_name": project.short_name,
            "total_contracts": total_contracts,
            "contracts_current": contracts_current,
            "contracts_overdue": contracts_overdue,
            "contracts_cancelled": contracts_cancelled,
            "total_portfolio": float(total_portfolio),
            "total_collected": float(total_collected),
            "total_pending": float(total_pending),
            "overdue_amount": float(overdue_amount)
        })
    
    return result


@router.get("/statement/{owner_id}", response_model=dict)
def get_owner_statement(
    owner_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Obtener estado de cuenta del propietario"""
    from app.infrastructure.owners_service import OwnersService
    
    summary = OwnersService.get_owner_with_summary(db, owner_id)
    if not summary:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Propietario no encontrado"
        )
    
    owner = summary["owner"]
    client = summary["client"]
    
    # Preparar contratos con detalle
    contracts_detail = []
    for contract in summary["contracts"]:
        from app.infrastructure.owners_service import ContractsService
        detail = ContractsService.get_contract_detail(db, contract.id)
        contracts_detail.append(detail)
    
    owner_name = f"{owner.first_name} {owner.paternal_surname}".strip() if owner.person_type == "natural" else owner.business_name
    
    return {
        "owner_id": owner.id,
        "owner_name": owner_name,
        "document_type": owner.document_type,
        "document_number": owner.document_number,
        "phone": client.phone,
        "email": client.email,
        "contracts": contracts_detail,
        "total_purchased": float(summary["total_purchased"]),
        "total_paid": float(summary["total_paid"]),
        "outstanding_balance": float(summary["outstanding_balance"]),
        "overdue_amount": float(summary["overdue_debt"]),
        "generated_at": db.query(func.now()).scalar().isoformat()
    }
