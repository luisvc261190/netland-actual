from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.domain.models import (
    Advisor,
    AuditLog,
    Client,
    Lead,
    Lot,
    Project,
    Quote,
    User,
    Visit,
)
from app.domain.owners_models import (
    CashPayment,
    Contract,
    FinancingPlan,
    Installment,
    Owner,
    Payment,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

ADMIN_ROLES = ("SUPER_ADMIN", "ADMIN")

ACTIVE_CONTRACT = "activo"
CANCELLED_CONTRACT_STATUSES = ("cancelado", "resuelto", "anulado")
PAID_INSTALLMENT_STATUSES = ("pagada", "anulada")


def _is_admin(user: User) -> bool:
    return bool(user.role and user.role.name in ADMIN_ROLES)


def _f(value) -> float:
    """Convierte Decimal/None a float para serializar."""
    try:
        return round(float(value or 0), 2)
    except (TypeError, ValueError):
        return 0.0


def _pct(part: float, total: float) -> float | None:
    if not total:
        return None
    return round(part / total * 100, 1)


def _advisor_id_for(user: User) -> int:
    advisor = getattr(user, "advisor", None)
    return advisor.id if advisor else -1


def _apply_project(q, model, project_id):
    if project_id:
        q = q.filter(model.project_id == project_id)
    return q


def _contracts_query(db, is_admin, advisor_id, project_id):
    q = db.query(Contract)
    if not is_admin:
        q = q.filter(Contract.advisor_id == advisor_id)
    q = _apply_project(q, Contract, project_id)
    return q.filter(Contract.status != "anulado")


def _date_window(period: str, date_from, date_to):
    """Devuelve (inicio, fin, inicio_previo, fin_previo) en rangos semi-abiertos.

    - "all" devuelve ventanas None.
    - Las ventanas son rodantes para "today", "week", "month", "quarter", "year".
    """
    if date_from and date_to:
        start = date_from
        end = date_to + timedelta(days=1)
        length = (date_to - start).days or 1
        return start, end, start - timedelta(days=length), start

    today = date.today()
    if period == "today":
        start, length = today, 1
    elif period == "week":
        start, length = today - timedelta(days=7), 7
    elif period == "month":
        start, length = today - timedelta(days=30), 30
    elif period == "quarter":
        start, length = today - timedelta(days=90), 90
    elif period == "year":
        start, length = today - timedelta(days=365), 365
    else:
        return None, None, None, None
    end = today + timedelta(days=1)
    return start, end, start - timedelta(days=length), start


def _sort_key_month(ym):
    y, m = ym
    return y * 12 + m


def _bucket_index(d, mode):
    return d if mode == "day" else (d.year, d.month)


def _trend_buckets(range_: str, today: date):
    if range_ in ("7d", "30d"):
        days = 7 if range_ == "7d" else 30
        start = today - timedelta(days=days - 1)
        return "day", [start + timedelta(days=i) for i in range(days)], start
    months = {"6m": 6, "12m": 12}
    n = months.get(range_)
    if range_ == "ytd":
        start = date(today.year, 1, 1)
    elif n:
        y, m = today.year, today.month
        for _ in range(n - 1):
            m -= 1
            if m == 0:
                m = 12
                y -= 1
        start = date(y, m, 1)
    else:
        start = today - timedelta(days=365)
    buckets = []
    y, m = start.year, start.month
    while (y, m) <= (today.year, today.month):
        buckets.append((y, m))
        m += 1
        if m == 13:
            m = 1
            y += 1
    return "month", buckets, start


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


def _owner_display_name(owner: Owner) -> str:
    if owner.business_name:
        return owner.business_name
    return " ".join(
        p for p in (owner.first_name, owner.paternal_surname, owner.maternal_surname) if p
    ).strip() or "Propietario"


@router.get("/summary")
def dashboard_summary(
    period: str = Query("month", pattern="^(today|week|month|quarter|year|all)$"),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    project_id: int | None = Query(None),
    advisor_id: int | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Resumen central del dashboard con KPIs, agrupado y filtrable por período/proyecto/asesor.

    - ADMIN / SUPER_ADMIN: ve totales globales (o filtrados).
    - ASESOR: solo sus registros; proyectos y lotes son globales.
    """
    is_admin = _is_admin(current_user)
    scoped_advisor = None if is_admin else _advisor_id_for(current_user)
    effective_advisor = None if is_admin else scoped_advisor
    if not is_admin:
        advisor_id = scoped_advisor

    start, end, prev_start, prev_end = _date_window(period, date_from, date_to)

    def _contracts():
        return _contracts_query(db, is_admin, scoped_advisor, project_id)

    def _contracts_in(start_d, end_d):
        q = _contracts()
        if start_d is not None:
            q = q.filter(
                Contract.contract_date >= start_d, Contract.contract_date < end_d
            )
        return q

    sales_total = _contracts().count()
    sales_current = _contracts_in(start, end).count()
    sales_previous = _contracts_in(prev_start, prev_end).count()
    sales_year = _contracts().filter(
        Contract.contract_date >= date(date.today().year, 1, 1),
        Contract.contract_date < date(date.today().year + 1, 1, 1),
    ).count()
    growth_pct = None
    if sales_previous:
        growth_pct = round((sales_current - sales_previous) / sales_previous * 100, 1)
    elif sales_current:
        growth_pct = 100.0

    sold_total = _f(
        _contracts()
        .with_entities(func.coalesce(func.sum(Contract.total_price), 0))
        .scalar()
    )
    sold_current = _f(
        _contracts_in(start, end)
        .with_entities(func.coalesce(func.sum(Contract.total_price), 0))
        .scalar()
    )

    # --- Ingresos y cobranza (siempre con scope para no filtrar al asesor en el futuro) ---
    payment_q = (
        db.query(Payment)
        .join(Contract, Contract.id == Payment.contract_id)
        .filter(Payment.is_cancelled.is_(False))
    )
    if not is_admin:
        payment_q = payment_q.filter(Contract.advisor_id == scoped_advisor)
    if project_id:
        payment_q = payment_q.filter(Contract.project_id == project_id)

    collected_total = _f(
        payment_q.with_entities(func.coalesce(func.sum(Payment.amount), 0)).scalar()
    )
    if start is not None:
        collected_current = _f(
            payment_q.filter(
                Payment.payment_date >= start, Payment.payment_date < end
            )
            .with_entities(func.coalesce(func.sum(Payment.amount), 0))
            .scalar()
        )
    else:
        collected_current = collected_total

    month_start = date.today().replace(day=1)
    payments_month = _f(
        payment_q.filter(Payment.payment_date >= month_start)
        .with_entities(func.coalesce(func.sum(Payment.amount), 0))
        .scalar()
    )

    def _active_filter(q):
        q = q.filter(
            Contract.status == ACTIVE_CONTRACT, Contract.status != "anulado"
        )
        if not is_admin:
            q = q.filter(Contract.advisor_id == scoped_advisor)
        if project_id:
            q = q.filter(Contract.project_id == project_id)
        return q

    financed_pending = (
        db.query(func.coalesce(func.sum(FinancingPlan.outstanding_balance), 0))
        .join(Contract, FinancingPlan.contract_id == Contract.id)
    )
    cash_pending = (
        db.query(func.coalesce(func.sum(CashPayment.balance), 0))
        .join(Contract, CashPayment.contract_id == Contract.id)
    )
    pending_total = _f(_active_filter(financed_pending).scalar()) + _f(
        _active_filter(cash_pending).scalar()
    )

    overdue_q = (
        db.query(func.coalesce(func.sum(Installment.balance), 0))
        .join(FinancingPlan, Installment.financing_plan_id == FinancingPlan.id)
        .join(Contract, FinancingPlan.contract_id == Contract.id)
        .filter(Installment.status == "vencida", Contract.status != "anulado")
    )
    if not is_admin:
        overdue_q = overdue_q.filter(Contract.advisor_id == scoped_advisor)
    if project_id:
        overdue_q = overdue_q.filter(Contract.project_id == project_id)
    overdue_debt = _f(overdue_q.scalar())

    # --- Clientes y leads ---
    def _clients_base():
        q = db.query(Client).join(Lead, Lead.client_id == Client.id)
        if not is_admin:
            q = q.filter(Lead.advisor_id == scoped_advisor)
        if project_id:
            q = q.filter(Lead.project_id == project_id)
        return q

    clients_total = (
        _clients_base().with_entities(func.count(func.distinct(Client.id))).scalar() or 0
    )
    clients_new = 0
    if start is not None:
        clients_new = (
            _clients_base()
            .filter(
                Client.created_at >= datetime.combine(start, datetime.min.time()),
                Client.created_at < datetime.combine(end, datetime.min.time()),
            )
            .with_entities(func.count(func.distinct(Client.id)))
            .scalar()
            or 0
        )

    leads_q = db.query(Lead)
    if not is_admin:
        leads_q = leads_q.filter(Lead.advisor_id == scoped_advisor)
    leads_q = _apply_project(leads_q, Lead, project_id)
    leads_new_current = 0
    if start is not None:
        leads_new_current = (
            leads_q.filter(
                Lead.created_at >= datetime.combine(start, datetime.min.time()),
                Lead.created_at < datetime.combine(end, datetime.min.time()),
            ).count()
        )

    # --- Cotizaciones ---
    quotes_q = db.query(Quote)
    if not is_admin:
        quotes_q = quotes_q.filter(Quote.advisor_id == scoped_advisor)
    quotes_q = _apply_project(quotes_q, Quote, project_id)
    quotes_total = quotes_q.count()
    quotes_current = 0
    if start is not None:
        quotes_current = quotes_q.filter(
            Quote.created_at >= datetime.combine(start, datetime.min.time()),
            Quote.created_at < datetime.combine(end, datetime.min.time()),
        ).count()
    quote_status = dict(
        quotes_q.with_entities(Quote.status, func.count(Quote.id))
        .group_by(Quote.status)
        .all()
    )

    # --- Lotes (global o por proyecto) ---
    lots_q = db.query(Lot)
    lots_q = _apply_project(lots_q, Lot, project_id)
    lots_map = dict(
        lots_q.with_entities(Lot.status, func.count(Lot.id)).group_by(Lot.status).all()
    )

    # --- Próximos pagos ---
    upcoming_q = (
        db.query(Installment, Contract, Owner, Project, Lot)
        .join(FinancingPlan, FinancingPlan.id == Installment.financing_plan_id)
        .join(Contract, Contract.id == FinancingPlan.contract_id)
        .join(Owner, Owner.id == Contract.owner_id)
        .join(Project, Project.id == Contract.project_id)
        .join(Lot, Lot.id == Contract.lot_id)
        .filter(Contract.status != "anulado")
        .filter(Installment.status.notin_(PAID_INSTALLMENT_STATUSES))
        .filter(Installment.due_date >= date.today())
    )
    if not is_admin:
        upcoming_q = upcoming_q.filter(Contract.advisor_id == scoped_advisor)
    if project_id:
        upcoming_q = upcoming_q.filter(Contract.project_id == project_id)
    upcoming = []
    for inst, contract, owner, project, lot in (
        upcoming_q.order_by(Installment.due_date.asc()).limit(8).all()
    ):
        upcoming.append(
            {
                "installment_id": inst.id,
                "contract_number": contract.contract_number,
                "owner_name": _owner_display_name(owner),
                "project_name": project.name,
                "lot_code": lot.code,
                "due_date": inst.due_date.isoformat(),
                "scheduled_amount": _f(inst.scheduled_amount),
                "balance": _f(inst.balance),
                "status": inst.status,
            }
        )

    return {
        "sales": {
            "total": sales_total,
            "current": sales_current,
            "previous": sales_previous,
            "year": sales_year,
            "growth_pct": growth_pct,
        },
        "revenue": {
            "sold_total": sold_total,
            "sold_current": sold_current,
            "collected_total": collected_total,
            "collected_current": collected_current,
            "pending_total": pending_total,
            "overdue_debt": overdue_debt,
            "payments_month": payments_month,
        },
        "clients": {
            "total": clients_total,
            "new_current": clients_new,
            "leads_new_current": leads_new_current,
            "quotes_current": quotes_current,
        },
        "lots": {
            "total": sum(lots_map.values()),
            "available": lots_map.get("available", 0),
            "reserved": lots_map.get("reserved", 0),
            "sold": lots_map.get("sold", 0),
            "not_available": lots_map.get("not_available", 0),
        },
        "quotes": {
            "total": quotes_total,
            "current": quotes_current,
            "pending": quote_status.get("draft", 0) + quote_status.get("sent", 0),
            "accepted": quote_status.get("accepted", 0),
            "rejected": quote_status.get("rejected", 0),
            "conversion_to_sale": _pct(sales_total, quotes_total),
        },
        "upcoming": upcoming,
    }


@router.get("/trend")
def dashboard_trend(
    range_: str = Query("30d", alias="range", pattern="^(7d|30d|6m|12m|ytd)$"),
    project_id: int | None = Query(None),
    advisor_id: int | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Serie temporal de ventas, cobranza y saldos de cuotas por período."""
    is_admin = _is_admin(current_user)
    scoped_advisor = None if is_admin else _advisor_id_for(current_user)
    today = date.today()
    mode, buckets, start = _trend_buckets(range_, today)
    end = today + timedelta(days=1)

    sales_count_map = {}
    sold_map = {}
    collected_map = {}
    due_map = {}

    contract_rows = (
        _contracts_query(db, is_admin, scoped_advisor, project_id)
        .filter(
            Contract.contract_date >= start, Contract.contract_date < end
        )
        .with_entities(Contract.contract_date, Contract.total_price)
        .all()
    )
    for cdate, amount in contract_rows:
        key = _bucket_index(cdate, mode)
        sales_count_map[key] = sales_count_map.get(key, 0) + 1
        sold_map[key] = sold_map.get(key, 0) + _f(amount)

    payment_q = (
        db.query(Payment)
        .join(Contract, Contract.id == Payment.contract_id)
        .filter(
            Payment.is_cancelled.is_(False),
            Payment.payment_date >= start,
            Payment.payment_date < end,
        )
    )
    if not is_admin:
        payment_q = payment_q.filter(Contract.advisor_id == scoped_advisor)
    if project_id:
        payment_q = payment_q.filter(Contract.project_id == project_id)
    for pdate, amount in payment_q.with_entities(
        Payment.payment_date, Payment.amount
    ).all():
        key = _bucket_index(pdate, mode)
        collected_map[key] = collected_map.get(key, 0) + _f(amount)

    due_q = (
        db.query(Installment)
        .join(FinancingPlan, Installment.financing_plan_id == FinancingPlan.id)
        .join(Contract, FinancingPlan.contract_id == Contract.id)
        .filter(
            Contract.status != "anulado",
            Installment.status.notin_(PAID_INSTALLMENT_STATUSES),
            Installment.due_date >= start,
            Installment.due_date < end,
        )
    )
    if not is_admin:
        due_q = due_q.filter(Contract.advisor_id == scoped_advisor)
    if project_id:
        due_q = due_q.filter(Contract.project_id == project_id)
    for inst in due_q.with_entities(Installment.due_date, Installment.balance).all():
        key = _bucket_index(inst[0], mode)
        due_map[key] = due_map.get(key, 0) + _f(inst[1])

    result = []
    for bucket in buckets:
        key = bucket
        if mode == "day":
            label = bucket.strftime("%d %b")
        else:
            label = f"{bucket[0]}-{bucket[1]:02d}"
        result.append(
            {
                "label": label,
                "period": bucket.isoformat() if mode == "day" else f"{bucket[0]}-{bucket[1]:02d}-01",
                "sales_count": sales_count_map.get(key, 0),
                "sold_amount": sold_map.get(key, 0),
                "collected_amount": collected_map.get(key, 0),
                "due_amount": due_map.get(key, 0),
            }
        )
    return result


@router.get("/projects")
def dashboard_projects(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Rendimiento por proyecto: lotes por estado, ocupación y monto vendido."""
    projects = db.query(Project).order_by(Project.name).all()

    lots_rows = (
        db.query(Lot.project_id, Lot.status, func.count(Lot.id))
        .group_by(Lot.project_id, Lot.status)
        .all()
    )
    lots_map: dict[int, dict[str, int]] = {}
    for pid, status, count in lots_rows:
        lots_map.setdefault(pid, {})[status] = count

    contracts_rows = (
        db.query(
            Contract.project_id,
            func.count(Contract.id),
            func.coalesce(func.sum(Contract.total_price), 0),
        )
        .filter(Contract.status != "anulado")
        .group_by(Contract.project_id)
        .all()
    )
    contract_map = {
        pid: {"count": count, "amount": _f(amount)}
        for pid, count, amount in contracts_rows
    }

    result = []
    for project in projects:
        statuses = lots_map.get(project.id, {})
        lots_total = sum(statuses.values())
        sold = statuses.get("sold", 0)
        contract = contract_map.get(project.id, {"count": 0, "amount": 0})
        result.append(
            {
                "project_id": project.id,
                "name": project.name,
                "lots_total": lots_total,
                "available": statuses.get("available", 0),
                "reserved": statuses.get("reserved", 0),
                "sold": sold,
                "not_available": statuses.get("not_available", 0),
                "occupancy_pct": _pct(sold, lots_total) or 0.0,
                "sold_amount": contract["amount"],
                "contracts_count": contract["count"],
            }
        )
    return result


@router.get("/advisors")
def dashboard_advisors(
    period: str = Query("month", pattern="^(month|quarter|year)$"),
    project_id: int | None = Query(None),
    advisor_id: int | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Ranking de asesores por ventas en el período seleccionado."""
    is_admin = _is_admin(current_user)
    scoped_advisor = None if is_admin else _advisor_id_for(current_user)
    length = {"month": 30, "quarter": 90, "year": 365}[period]
    today = date.today()
    start = today - timedelta(days=length - 1)
    start_dt = datetime.combine(start, datetime.min.time())
    end_dt = datetime.combine(today + timedelta(days=1), datetime.min.time())

    advisors = db.query(Advisor).order_by(Advisor.name).all()
    if not is_admin:
        advisors = [adv for adv in advisors if adv.id == scoped_advisor]

    result = []
    for adv in advisors:
        quote_q = db.query(func.count(Quote.id)).filter(
            Quote.advisor_id == adv.id,
            Quote.created_at >= start_dt,
            Quote.created_at < end_dt,
        )
        client_q = (
            db.query(func.count(func.distinct(Client.id)))
            .join(Lead, Lead.client_id == Client.id)
            .filter(
                Lead.advisor_id == adv.id,
                Lead.created_at >= start_dt,
                Lead.created_at < end_dt,
            )
        )
        sale_q = (
            db.query(func.count(Contract.id), func.coalesce(func.sum(Contract.total_price), 0))
            .filter(
                Contract.advisor_id == adv.id,
                Contract.status != "anulado",
                Contract.contract_date >= start,
                Contract.contract_date < today + timedelta(days=1),
            )
        )
        if project_id:
            quote_q = quote_q.filter(Quote.project_id == project_id)
            client_q = client_q.filter(Lead.project_id == project_id)
            sale_q = sale_q.filter(Contract.project_id == project_id)

        quotes_count = quote_q.scalar() or 0
        clients_count = client_q.scalar() or 0
        sales_count, sold_amount = sale_q.one()
        sold_amount = _f(sold_amount)

        result.append(
            {
                "advisor_id": adv.id,
                "advisor_name": adv.name,
                "quotes_count": quotes_count,
                "clients_count": clients_count,
                "sales_count": sales_count,
                "sold_amount": sold_amount,
                "conversion_pct": _pct(sales_count, quotes_count),
            }
        )

    result.sort(key=lambda r: (r["sold_amount"], r["sales_count"]), reverse=True)
    for position, row in enumerate(result, start=1):
        row["position"] = position
    return result


@router.get("/funnel")
def dashboard_funnel(
    project_id: int | None = Query(None),
    advisor_id: int | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Embudo comercial a partir de estados reales de leads, visitas, cotizaciones y ventas."""
    is_admin = _is_admin(current_user)
    scoped_advisor = None if is_admin else _advisor_id_for(current_user)

    leads_q = db.query(Lead)
    if not is_admin:
        leads_q = leads_q.filter(Lead.advisor_id == scoped_advisor)
    leads_q = _apply_project(leads_q, Lead, project_id)
    status_counts = dict(
        leads_q.with_entities(Lead.status, func.count(Lead.id))
        .group_by(Lead.status)
        .all()
    )

    def stage(*keys):
        return sum(status_counts.get(k, 0) for k in keys)

    leads_total = sum(status_counts.values())
    contacted_or_later = stage(
        "contacted", "interested", "visit_scheduled", "negotiation", "reserved", "sold"
    )
    interested_or_later = stage(
        "interested", "visit_scheduled", "negotiation", "reserved", "sold"
    )
    separated = stage("reserved", "sold")

    visits_q = db.query(func.count(Visit.id))
    if not is_admin:
        visits_q = visits_q.filter(Visit.advisor_id == scoped_advisor)
    if project_id:
        visits_q = visits_q.filter(Visit.project_id == project_id)
    visits_total = visits_q.scalar() or 0

    quotes_q = db.query(func.count(Quote.id))
    if not is_admin:
        quotes_q = quotes_q.filter(Quote.advisor_id == scoped_advisor)
    if project_id:
        quotes_q = quotes_q.filter(Quote.project_id == project_id)
    quotes_total = quotes_q.scalar() or 0

    contracts_total = _contracts_query(db, is_admin, scoped_advisor, project_id).count()

    stages = [
        {"stage": "Leads", "count": leads_total},
        {"stage": "Contactados", "count": contacted_or_later},
        {"stage": "Interesados", "count": interested_or_later},
        {"stage": "Visitas", "count": visits_total},
        {"stage": "Cotizaciones", "count": quotes_total},
        {"stage": "Separaciones", "count": separated},
        {"stage": "Ventas", "count": contracts_total},
    ]
    conversions = [
        {
            "from": "Contactados",
            "to": "Interesados",
            "rate": _pct(interested_or_later, contacted_or_later),
        },
        {
            "from": "Interesados",
            "to": "Cotizaciones",
            "rate": _pct(quotes_total, interested_or_later),
        },
        {
            "from": "Cotizaciones",
            "to": "Ventas",
            "rate": _pct(contracts_total, quotes_total),
        },
        {
            "from": "Leads",
            "to": "Ventas",
            "rate": _pct(contracts_total, leads_total),
        },
    ]
    return {"stages": stages, "conversions": conversions}


@router.get("/leads-by-source")
def dashboard_lead_sources(
    range_: str | None = Query(None, alias="range", pattern="^(30d|6m|12m)$"),
    project_id: int | None = Query(None),
    advisor_id: int | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Distribución de leads por origen (fuente)."""
    is_admin = _is_admin(current_user)
    scoped_advisor = None if is_admin else _advisor_id_for(current_user)

    leads_q = db.query(Lead)
    if not is_admin:
        leads_q = leads_q.filter(Lead.advisor_id == scoped_advisor)
    leads_q = _apply_project(leads_q, Lead, project_id)
    if range_:
        today = date.today()
        window = {"30d": 30, "6m": 180, "12m": 365}[range_]
        start_dt = datetime.combine(today - timedelta(days=window - 1), datetime.min.time())
        leads_q = leads_q.filter(Lead.created_at >= start_dt)

    rows = (
        leads_q.with_entities(
            Lead.source,
            func.count(Lead.id),
        )
        .group_by(Lead.source)
        .order_by(func.count(Lead.id).desc())
        .all()
    )
    total = sum(count for _, count in rows)
    result = []
    for source, count in rows:
        result.append(
            {
                "source": source or "otro",
                "count": count,
                "pct": _pct(count, total),
            }
        )
    return {"total": total, "items": result}


@router.get("/clients-trend")
def dashboard_clients_trend(
    range_: str = Query("6m", alias="range", pattern="^(30d|6m|12m)$"),
    project_id: int | None = Query(None),
    advisor_id: int | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Evolución mensual (o diaria para 30d) de nuevos clientes y leads."""
    is_admin = _is_admin(current_user)
    scoped_advisor = None if is_admin else _advisor_id_for(current_user)
    today = date.today()
    if range_ == "30d":
        mode, buckets, start = "day", [today - timedelta(days=29 - i) for i in range(30)], today - timedelta(days=29)
    else:
        mode, buckets, start = _trend_buckets(range_, today)
    end = today + timedelta(days=1)

    scoped = (not is_admin) or bool(project_id)

    client_map = {}
    if scoped:
        lead_q = db.query(Lead)
        if not is_admin:
            lead_q = lead_q.filter(Lead.advisor_id == scoped_advisor)
        lead_q = _apply_project(lead_q, Lead, project_id)
        lead_rows = (
            lead_q.filter(
                Lead.created_at >= datetime.combine(start, datetime.min.time()),
                Lead.created_at < datetime.combine(end, datetime.min.time()),
            )
            .with_entities(Lead.client_id, Lead.created_at)
            .all()
        )
        seen = set()
        for client_id, created_at in lead_rows:
            key = _bucket_index(created_at.date(), mode)
            if client_id and (key, client_id) not in seen:
                seen.add((key, client_id))
                client_map[key] = client_map.get(key, 0) + 1
    else:
        client_rows = (
            db.query(Client.created_at)
            .filter(
                Client.created_at >= datetime.combine(start, datetime.min.time()),
                Client.created_at < datetime.combine(end, datetime.min.time()),
            )
            .all()
        )
        for (created_at,) in client_rows:
            key = _bucket_index(created_at.date(), mode)
            client_map[key] = client_map.get(key, 0) + 1

    lead_map = {}
    if scoped:
        for client_id, created_at in lead_rows:
            key = _bucket_index(created_at.date(), mode)
            lead_map[key] = lead_map.get(key, 0) + 1
    else:
        lead_rows_all = (
            db.query(Lead.created_at)
            .filter(
                Lead.created_at >= datetime.combine(start, datetime.min.time()),
                Lead.created_at < datetime.combine(end, datetime.min.time()),
            )
            .all()
        )
        for (created_at,) in lead_rows_all:
            key = _bucket_index(created_at.date(), mode)
            lead_map[key] = lead_map.get(key, 0) + 1

    result = []
    for bucket in buckets:
        if mode == "day":
            label = bucket.strftime("%d %b")
            period = bucket.isoformat()
        else:
            label = f"{bucket[0]}-{bucket[1]:02d}"
            period = f"{bucket[0]}-{bucket[1]:02d}-01"
        result.append(
            {
                "label": label,
                "period": period,
                "clients": client_map.get(bucket, 0),
                "leads": lead_map.get(bucket, 0),
            }
        )
    return result


@router.get("/activity")
def dashboard_activity(
    limit: int = Query(15, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Últimas acciones registradas en el sistema (audit_logs)."""
    rows = (
        db.query(AuditLog, User.name)
        .outerjoin(User, AuditLog.user_id == User.id)
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": log.id,
            "action": log.action,
            "entity": log.entity,
            "entity_id": log.entity_id,
            "details": log.details,
            "created_at": log.created_at.isoformat() if log.created_at else None,
            "user_name": user_name,
        }
        for log, user_name in rows
    ]
