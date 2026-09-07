from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.domain.models import Advisor, Lead, Lot, Project, Quote, User, Visit
from app.domain.owners_models import Contract, FinancingPlan, Installment, Owner, Payment

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

ADMIN_ROLES = ("SUPER_ADMIN", "ADMIN")


def _is_admin(user: User) -> bool:
    return bool(user.role and user.role.name in ADMIN_ROLES)


@router.get("/stats")
def dashboard_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Métricas del panel.

    - ADMIN / SUPER_ADMIN: ve totales globales.
    - ASESOR: ve sus propias métricas (sus clientes captados, visitas y cotizaciones).
      Los datos de proyectos y lotes son globales porque ya tiene acceso a ellos.
    """
    is_admin = _is_admin(current_user)
    advisor = None if is_admin else current_user.advisor
    advisor_id = advisor.id if advisor else -1

    def _leads_query():
        q = db.query(Lead)
        if not is_admin:
            q = q.filter(Lead.advisor_id == advisor_id)
        return q

    lots_status = (
        db.query(Lot.status, func.count(Lot.id))
        .group_by(Lot.status)
        .all()
    )
    status_map = dict(lots_status)

    leads_status = (
        _leads_query()
        .with_entities(Lead.status, func.count(Lead.id))
        .group_by(Lead.status)
        .all()
    )
    lead_map = dict(leads_status)

    visits_count = db.query(func.count(Visit.id))
    quotes_count = db.query(func.count(Quote.id))
    if not is_admin:
        visits_count = visits_count.filter(Visit.advisor_id == advisor_id)
        quotes_count = quotes_count.filter(Quote.advisor_id == advisor_id)

    leads_by_project_ids = dict(
        _leads_query()
        .with_entities(Lead.project_id, func.count(Lead.id))
        .filter(Lead.project_id.isnot(None))
        .group_by(Lead.project_id)
        .all()
    )
    leads_by_project = [
        {"project": project.name, "count": leads_by_project_ids.get(project.id, 0)}
        for project in db.query(Project).order_by(Project.name).all()
    ]

    # Métricas del módulo de Propietarios y Cobranzas (solo para administración)
    owners_total = 0
    contracts_total = 0
    contracts_active = 0
    pending_balance = 0.0
    overdue_debt = 0.0
    if is_admin:
        owners_total = db.query(func.count(Owner.id)).scalar() or 0
        contracts_total = db.query(func.count(Contract.id)).scalar() or 0
        contracts_active = (
            db.query(func.count(Contract.id))
            .filter(Contract.status == "activo")
            .scalar()
            or 0
        )
        overdue = (
            db.query(func.sum(Installment.balance))
            .filter(Installment.status == "vencida")
            .scalar()
            or 0
        )
        financed_pending = (
            db.query(func.sum(FinancingPlan.outstanding_balance))
            .join(Contract)
            .filter(Contract.status == "activo")
            .scalar()
            or 0
        )
        overdue_debt = float(overdue)
        pending_balance = float(financed_pending)

    return {
        "projects_total": db.query(func.count(Project.id)).scalar() or 0,
        "projects_published": db.query(func.count(Project.id)).filter(Project.is_published.is_(True)).scalar() or 0,
        "lots_total": db.query(func.count(Lot.id)).scalar() or 0,
        "lots_available": status_map.get("available", 0),
        "lots_reserved": status_map.get("reserved", 0),
        "lots_sold": status_map.get("sold", 0),
        "lots_not_available": status_map.get("not_available", 0),
        "leads_total": sum(count for _, count in leads_status),
        "leads_new": lead_map.get("new", 0),
        "leads_visit_scheduled": lead_map.get("visit_scheduled", 0),
        "leads_by_status": [{"status": s, "count": c} for s, c in leads_status],
        "lots_by_status": [{"status": s, "count": c} for s, c in lots_status],
        "visits_total": visits_count.scalar() or 0,
        "advisors_total": db.query(func.count(Advisor.id)).scalar() or 0,
        "quotes_total": quotes_count.scalar() or 0,
        "leads_by_project": leads_by_project,
        "owners_total": owners_total,
        "contracts_total": contracts_total,
        "contracts_active": contracts_active,
        "pending_balance": pending_balance,
        "overdue_debt": overdue_debt,
    }
