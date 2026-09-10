from datetime import datetime, date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_user, require_admin
from app.core.pricing import compute_payment_plan, lot_gross_price
from app.domain.models import (
    Advisor,
    Client,
    Lead,
    Lot,
    Project,
    Quote,
    QuoteItem,
    SiteConfig,
    User,
    Visit,
)
from app.infrastructure.pdf_service import generate_quote_pdf
from app.schemas.crm import (
    AdvisorCreate,
    AdvisorOut,
    AdvisorUpdate,
    CapturedLeadCreate,
    ClientOut,
    LeadCreate,
    LeadOut,
    LeadUpdate,
    PublicLeadCreate,
    QuoteCreate,
    QuoteOut,
    QuoteUpdate,
    VisitCreate,
    VisitOut,
    VisitUpdate,
)

router = APIRouter(tags=["crm"])

LEAD_STATUSES = [
    "new",
    "contacted",
    "interested",
    "visit_scheduled",
    "negotiation",
    "reserved",
    "sold",
    "discarded",
]


def _lead_out(lead: Lead) -> LeadOut:
    out = LeadOut.model_validate(lead)
    if lead.client:
        out.client = ClientOut.model_validate(lead.client)
    if lead.project:
        out.project_name = lead.project.name
    if lead.lot:
        out.lot_code = lead.lot.code
    if lead.advisor:
        out.advisor_name = lead.advisor.name
    return out


def _quote_out(quote: Quote) -> QuoteOut:
    out = QuoteOut.model_validate(quote)
    if quote.project:
        out.project_name = quote.project.name
    if quote.lot:
        out.lot_code = quote.lot.code
        out.lot_area = float(quote.lot.area_m2) if quote.lot.area_m2 else None
    if quote.advisor:
        out.advisor_name = quote.advisor.name
    return out


def _is_admin_user(user: User) -> bool:
    return bool(user.role and user.role.name in ("SUPER_ADMIN", "ADMIN"))


def _next_quote_number(db: Session) -> str:
    """Genera un número de cotización único para hoy, reutilizando huecos
    dejados por cotizaciones eliminadas para evitar colisiones."""
    today = datetime.now().strftime("%Y%m%d")
    prefix = f"COT-{today}-"
    taken = {
        row[0]
        for row in db.query(Quote.quote_number)
        .filter(Quote.quote_number.like(f"{prefix}%"))
    }
    seq = len(taken) + 1
    while f"{prefix}{seq:04d}" in taken:
        seq += 1
    return f"{prefix}{seq:04d}"


def _ensure_lead_access(user: User, lead: Lead) -> None:
    """Los asesores solo pueden acceder a los leads que ellos gestionan."""
    if _is_admin_user(user):
        return
    advisor = user.advisor
    if advisor is None or lead.advisor_id != advisor.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes acceso a este cliente.",
        )


def _scoped_advisor_id(user: User) -> int:
    """ID del asesor para acotar queries de usuarios no administradores (-1 = sin resultados)."""
    advisor = user.advisor
    return advisor.id if advisor else -1


def _ensure_visit_access(user: User, visit: Visit) -> None:
    """Los asesores solo pueden acceder a sus propias visitas."""
    if _is_admin_user(user):
        return
    advisor = user.advisor
    if advisor is None or visit.advisor_id != advisor.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes acceso a esta visita.",
        )


def _ensure_quote_access(user: User, quote: Quote) -> None:
    """Los asesores solo pueden acceder a sus propias cotizaciones."""
    if _is_admin_user(user):
        return
    advisor = user.advisor
    owns_quote = advisor is not None and quote.advisor_id == advisor.id
    owns_via_lead = (
        quote.lead is not None and advisor is not None and quote.lead.advisor_id == advisor.id
    )
    if not (owns_quote or owns_via_lead):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes acceso a esta cotización.",
        )


def _apply_quote_values(quote: Quote, payload, lot: Lot):
    """Aplica el pricing de una cotización sobre el quote a partir de un lote.

    Recalcula precio por m², recargos, descuento, tipo de pago y total.
    Retorna un dict con los valores calculados para reconstruir los ítems.
    """
    sent = payload.model_fields_set

    area = float(lot.area_m2) if lot.area_m2 else None
    esquina_surcharge = round(float(payload.esquina_surcharge or 0), 2)
    frente_parque_surcharge = round(float(payload.frente_parque_surcharge or 0), 2)
    frente_a_pista_surcharge = round(float(payload.frente_a_pista_surcharge or 0), 2)

    price_per_m2 = payload.price_per_m2
    if price_per_m2 is None:
        price_per_m2 = float(lot.price_per_m2) if lot.price_per_m2 else None

    if price_per_m2 is not None and area:
        price_per_m2_value = round(float(price_per_m2), 2)
        lot_price = lot_gross_price(
            area * price_per_m2_value,
            esquina_surcharge=esquina_surcharge,
            frente_parque_surcharge=frente_parque_surcharge,
            frente_a_pista_surcharge=frente_a_pista_surcharge,
        )
    elif payload.lot_price:
        lot_price = round(float(payload.lot_price), 2)
        price_per_m2_value = None
    else:
        lot_price_value = lot.promo_price or lot.price
        if lot_price_value is None:
            raise HTTPException(
                status_code=400,
                detail="Ingresa el precio por m² o define un precio para el lote.",
            )
        lot_price = round(float(lot_price_value), 2)
        price_per_m2_value = (
            round(float(lot.price_per_m2), 2) if lot.price_per_m2 else None
        )

    plan = compute_payment_plan(
        gross_price=lot_price,
        discount_type=payload.discount_type,
        discount_value=payload.discount_value,
        payment_type=payload.payment_type,
        initial_payment=float(payload.initial_payment or 0),
        installments=int(payload.installments or 12),
    )
    discount_amount = plan["discount_amount"]
    final_price = plan["final_price"]
    initial = plan["initial_payment"]
    installments = plan["installment_count"]
    installment_value = plan["installment_value"]

    quote.project_id = lot.project_id
    quote.lot_id = lot.id
    quote.lot_price = lot_price
    quote.price_per_m2 = price_per_m2_value
    quote.esquina_surcharge = esquina_surcharge
    quote.frente_parque_surcharge = frente_parque_surcharge
    quote.frente_a_pista_surcharge = frente_a_pista_surcharge
    quote.total_amount = final_price
    quote.installment_value = installment_value

    if "lead_id" in sent:
        quote.lead_id = payload.lead_id
    if "discount_type" in sent:
        quote.discount_type = payload.discount_type
    if "discount_value" in sent:
        quote.discount_value = round(float(payload.discount_value or 0), 2)
    if "payment_type" in sent:
        quote.payment_type = payload.payment_type
    if "initial_payment" in sent:
        quote.initial_payment = initial
    if "installments" in sent:
        quote.installments = installments
    if "client_name" in sent:
        quote.client_name = payload.client_name or ""
    if "client_phone" in sent:
        quote.client_phone = payload.client_phone or ""
    if "client_email" in sent:
        quote.client_email = payload.client_email or ""
    if "notes" in sent:
        quote.notes = payload.notes or ""

    return {
        "area": area,
        "price_per_m2_value": price_per_m2_value,
        "lot_price": lot_price,
        "esquina_surcharge": esquina_surcharge,
        "frente_parque_surcharge": frente_parque_surcharge,
        "frente_a_pista_surcharge": frente_a_pista_surcharge,
        "discount_amount": discount_amount,
        "initial": initial,
        "installments": installments,
        "installment_value": installment_value,
    }


def _replace_quote_items(db: Session, quote: Quote, lot: Lot, values: dict) -> None:
    """Reconstruye los ítems de una cotización a partir de los valores calculados."""
    for item in list(quote.items):
        db.delete(item)
    db.flush()

    area = values["area"]
    price_per_m2_value = values["price_per_m2_value"]
    lot_price = values["lot_price"]
    esquina_surcharge = values["esquina_surcharge"]
    frente_parque_surcharge = values["frente_parque_surcharge"]
    frente_a_pista_surcharge = values["frente_a_pista_surcharge"]
    discount_amount = values["discount_amount"]
    initial = values["initial"]
    installments = values["installments"]
    installment_value = values["installment_value"]

    if price_per_m2_value is not None and area:
        db.add(
            QuoteItem(
                quote_id=quote.id,
                description=f"Lote {lot.code} ({area:,.2f} m² × S/ {price_per_m2_value:,.2f})",
                amount=round(area * price_per_m2_value, 2),
            )
        )
    else:
        db.add(QuoteItem(quote_id=quote.id, description=f"Lote {lot.code}", amount=lot_price))
    if esquina_surcharge > 0:
        db.add(QuoteItem(quote_id=quote.id, description="Recargo lote en esquina", amount=esquina_surcharge))
    if frente_parque_surcharge > 0:
        db.add(QuoteItem(quote_id=quote.id, description="Recargo frente a parque", amount=frente_parque_surcharge))
    if frente_a_pista_surcharge > 0:
        db.add(QuoteItem(quote_id=quote.id, description="Recargo frente a pista", amount=frente_a_pista_surcharge))
    if discount_amount > 0:
        db.add(QuoteItem(quote_id=quote.id, description=f"Descuento ({quote.discount_type})", amount=-discount_amount))
    if quote.payment_type == "credit":
        db.add(QuoteItem(quote_id=quote.id, description="Cuota inicial", amount=initial))
        db.add(QuoteItem(quote_id=quote.id, description=f"Saldo en {installments} cuotas", amount=installment_value))


def _auto_assign_lead_to_advisor(lead: Lead, db: Session) -> None:
    """Asigna automáticamente un lead a un asesor disponible usando distribución equitativa.
    
    Lógica:
    1. Busca asesores disponibles (is_available=True)
    2. Cuenta los leads asignados a cada asesor
    3. Asigna al asesor con menos leads activos
    4. Si hay empate, asigna al asesor creado más recientemente
    """
    # Obtener asesores disponibles
    advisors = db.query(Advisor).filter(Advisor.is_available == True).order_by(Advisor.created_at.desc()).all()
    
    if not advisors:
        # Si no hay asesores disponibles, no asignar
        return
    
    # Contar leads por asesor (excluyendo los descartados)
    advisor_lead_counts = {}
    for advisor in advisors:
        count = db.query(func.count(Lead.id)).filter(
            Lead.advisor_id == advisor.id,
            Lead.status.not_in(["discarded", "sold"])
        ).scalar()
        advisor_lead_counts[advisor.id] = count or 0
    
    # Encontrar el asesor con menos leads
    min_leads = min(advisor_lead_counts.values())
    candidates = [aid for aid, count in advisor_lead_counts.items() if count == min_leads]
    
    # Si hay empate, tomar el asesor más reciente de los candidatos
    selected_advisor = next((a for a in advisors if a.id in candidates), None)
    
    if selected_advisor:
        lead.advisor_id = selected_advisor.id


# ---- Leads ----

@router.post("/leads", response_model=LeadOut, status_code=201)
def create_lead(payload: PublicLeadCreate | LeadCreate, db: Session = Depends(get_db)):
    """Endpoint público y admin para crear un lead.
    
    - Si no se especifica advisor_id, se asigna automáticamente
    - Admin puede especificar advisor_id manualmente
    """
    client = Client(
        name=payload.name,
        last_name=payload.last_name,
        phone=payload.phone,
        whatsapp=payload.whatsapp or payload.phone,
        email=payload.email,
    )
    db.add(client)
    db.flush()

    lead = Lead(
        client_id=client.id,
        project_id=getattr(payload, "project_id", None),
        lot_id=getattr(payload, "lot_id", None),
        advisor_id=getattr(payload, "advisor_id", None),
        budget=getattr(payload, "budget", None),
        source=getattr(payload, "source", "web"),
        message=getattr(payload, "message", ""),
    )
    
    # Si no se especificó advisor, asignar automáticamente
    if lead.advisor_id is None:
        _auto_assign_lead_to_advisor(lead, db)
    
    db.add(lead)
    db.commit()
    db.refresh(lead)
    return _lead_out(lead)


@router.post("/leads/captured", response_model=LeadOut, status_code=201)
def create_captured_lead(
    payload: CapturedLeadCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Registro manual de clientes captados en campo o por llamada.

    - ASESOR: el lead se asigna automáticamente a su propio perfil de asesor
      (se crea uno si aún no tiene) y no puede asignar a otro asesor.
    - ADMIN / SUPER_ADMIN: pueden elegir asesor; por defecto se usa su propio
      perfil de asesor si existe.
    """
    role_name = current_user.role.name if current_user.role else ""
    is_admin = role_name in ("SUPER_ADMIN", "ADMIN")

    advisor: Advisor | None = None
    if is_admin and payload.advisor_id:
        advisor = db.get(Advisor, payload.advisor_id)
        if not advisor:
            raise HTTPException(status_code=404, detail="Asesor no encontrado.")
    elif current_user.advisor:
        advisor = current_user.advisor

    if advisor is None:
        advisor = Advisor(name=current_user.name, email=current_user.email)
        db.add(advisor)
        db.flush()
        current_user.advisor = advisor

    client = Client(
        name=payload.name,
        last_name=payload.last_name,
        phone=payload.phone,
        whatsapp=payload.whatsapp or payload.phone,
        email=payload.email,
    )
    db.add(client)
    db.flush()

    lead = Lead(
        client_id=client.id,
        project_id=payload.project_id,
        advisor_id=advisor.id,
        budget=payload.budget,
        source=payload.source,
        message=payload.message,
        follow_up=payload.follow_up,
    )
    db.add(lead)
    db.commit()
    db.refresh(lead)
    return _lead_out(lead)


@router.get("/leads", response_model=list[LeadOut])
def list_leads(
    status_filter: str | None = Query(default=None, alias="status"),
    source: str | None = Query(default=None, description="Origen(es) separados por coma, ej: campo,llamada"),
    exclude_source: str | None = Query(default=None, description="Origen(es) a excluir, ej: campo,llamada"),
    advisor_id: int | None = None,
    project_id: int | None = None,
    search: str | None = None,
    date_from: date | None = Query(default=None, description="Fecha desde (YYYY-MM-DD)"),
    date_to: date | None = Query(default=None, description="Fecha hasta (YYYY-MM-DD)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Listar leads con filtros avanzados.
    
    Filtros disponibles:
    - status: Estado del lead
    - source: Fuente(s) separadas por coma
    - exclude_source: Fuente(s) a excluir
    - advisor_id: ID del asesor asignado
    - project_id: ID del proyecto
    - search: Búsqueda por nombre, apellido o teléfono
    - date_from: Fecha desde (incluida)
    - date_to: Fecha hasta (incluida)
    """
    q = db.query(Lead).options(
        joinedload(Lead.client),
        joinedload(Lead.project),
        joinedload(Lead.lot),
        joinedload(Lead.advisor)
    )
    
    # Control de acceso: asesores solo ven sus leads
    if not _is_admin_user(current_user):
        advisor = current_user.advisor
        q = q.filter(Lead.advisor_id == (advisor.id if advisor else -1))
    
    # Filtro por estado
    if status_filter:
        q = q.filter(Lead.status == status_filter)
    
    # Filtro por fuente (incluir)
    if source:
        sources = [s.strip().lower() for s in source.split(",") if s.strip()]
        if sources:
            q = q.filter(Lead.source.in_(sources))
    
    # Filtro por fuente (excluir)
    if exclude_source:
        excluded = [s.strip().lower() for s in exclude_source.split(",") if s.strip()]
        if excluded:
            q = q.filter(~Lead.source.in_(excluded))
    
    # Filtro por asesor (advisor_id=0 significa "sin asignar")
    if advisor_id is not None:
        if advisor_id == 0:
            q = q.filter(Lead.advisor_id.is_(None))
        else:
            q = q.filter(Lead.advisor_id == advisor_id)
    
    # Filtro por proyecto
    if project_id:
        q = q.filter(Lead.project_id == project_id)
    
    # Filtro por fecha (desde)
    if date_from:
        q = q.filter(func.date(Lead.created_at) >= date_from)
    
    # Filtro por fecha (hasta)
    if date_to:
        q = q.filter(func.date(Lead.created_at) <= date_to)
    
    # Búsqueda por texto
    if search:
        q = q.join(Client).filter(
            (Client.name.ilike(f"%{search}%")) |
            (Client.last_name.ilike(f"%{search}%")) |
            (Client.phone.ilike(f"%{search}%"))
        )
    
    leads = q.order_by(Lead.created_at.desc()).all()
    return [_lead_out(lead) for lead in leads]


@router.get("/leads/{lead_id}", response_model=LeadOut, dependencies=[Depends(get_current_user)])
def get_lead(
    lead_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    lead = db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead no encontrado.")
    _ensure_lead_access(current_user, lead)
    return _lead_out(lead)


@router.patch("/leads/{lead_id}", response_model=LeadOut)
def update_lead(
    lead_id: int,
    payload: LeadUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    lead = db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead no encontrado.")
    _ensure_lead_access(current_user, lead)
    data = payload.model_dump(exclude_unset=True)

    if not _is_admin_user(current_user):
        data.pop("advisor_id", None)

    if "status" in data:
        if data["status"] not in LEAD_STATUSES:
            raise HTTPException(status_code=400, detail="Estado de lead inválido.")
        if data["status"] == "reserved" and lead.lot and lead.lot.status == "available":
            lead.lot.status = "reserved"
        if data["status"] == "sold" and lead.lot:
            lead.lot.status = "sold"
        if data["status"] == "discarded" and lead.lot and lead.lot.status == "reserved":
            lead.lot.status = "available"

    if "phone" in data and lead.client:
        lead.client.phone = data["phone"]
    if "whatsapp" in data and lead.client:
        lead.client.whatsapp = data["whatsapp"]
    if "email" in data and lead.client:
        lead.client.email = data["email"]
    if "name" in data and lead.client:
        lead.client.name = data["name"]
    if "last_name" in data and lead.client:
        lead.client.last_name = data["last_name"]

    for key in ("status", "project_id", "lot_id", "advisor_id", "budget", "follow_up", "source"):
        if key in data:
            setattr(lead, key, data[key])

    db.commit()
    db.refresh(lead)
    return _lead_out(lead)


@router.delete("/leads/{lead_id}", status_code=204, dependencies=[Depends(require_admin)])
def delete_lead(lead_id: int, db: Session = Depends(get_db)):
    lead = db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead no encontrado.")
    db.delete(lead)
    db.commit()


# ---- Clients ----

@router.get("/clients", response_model=list[ClientOut])
def list_clients(
    search: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(Client)
    if not _is_admin_user(current_user):
        # Los asesores solo ven los clientes de sus propios leads.
        q = (
            q.join(Lead, Lead.client_id == Client.id)
            .filter(Lead.advisor_id == _scoped_advisor_id(current_user))
            .distinct()
        )
    if search:
        q = q.filter((Client.name.ilike(f"%{search}%")) | (Client.phone.ilike(f"%{search}%")))
    return [ClientOut.model_validate(c) for c in q.order_by(Client.created_at.desc()).all()]


# ---- Advisors ----

@router.get("/advisors", response_model=list[AdvisorOut])
def list_advisors(db: Session = Depends(get_db)):
    return [
        AdvisorOut.model_validate(a)
        for a in db.query(Advisor).order_by(Advisor.created_at.desc()).all()
    ]


@router.post("/advisors", response_model=AdvisorOut, dependencies=[Depends(require_admin)])
def create_advisor(payload: AdvisorCreate, db: Session = Depends(get_db)):
    advisor = Advisor(**payload.model_dump())
    db.add(advisor)
    db.commit()
    db.refresh(advisor)
    return AdvisorOut.model_validate(advisor)


@router.put("/advisors/{advisor_id}", response_model=AdvisorOut, dependencies=[Depends(require_admin)])
def update_advisor(advisor_id: int, payload: AdvisorUpdate, db: Session = Depends(get_db)):
    advisor = db.get(Advisor, advisor_id)
    if not advisor:
        raise HTTPException(status_code=404, detail="Asesor no encontrado.")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(advisor, key, value)
    db.commit()
    db.refresh(advisor)
    return AdvisorOut.model_validate(advisor)


@router.delete("/advisors/{advisor_id}", status_code=204, dependencies=[Depends(require_admin)])
def delete_advisor(advisor_id: int, db: Session = Depends(get_db)):
    advisor = db.get(Advisor, advisor_id)
    if not advisor:
        raise HTTPException(status_code=404, detail="Asesor no encontrado.")
    db.delete(advisor)
    db.commit()


# ---- Visits ----

@router.get("/visits", response_model=list[VisitOut])
def list_visits(
    status_filter: str | None = Query(default=None, alias="status"),
    advisor_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(Visit).options(joinedload(Visit.lead).joinedload(Lead.client), joinedload(Visit.project), joinedload(Visit.advisor))
    if not _is_admin_user(current_user):
        # Los asesores solo ven sus propias visitas, sin importar los filtros enviados.
        q = q.filter(Visit.advisor_id == _scoped_advisor_id(current_user))
    if status_filter:
        q = q.filter(Visit.status == status_filter)
    if advisor_id and _is_admin_user(current_user):
        q = q.filter(Visit.advisor_id == advisor_id)
    visits = q.order_by(Visit.scheduled_at.desc()).all()
    result = []
    for v in visits:
        out = VisitOut.model_validate(v)
        out.lead_name = f"{v.lead.client.name} {v.lead.client.last_name}".strip() if v.lead and v.lead.client else None
        out.project_name = v.project.name if v.project else None
        out.advisor_name = v.advisor.name if v.advisor else None
        result.append(out)
    return result


@router.post("/visits", response_model=VisitOut, status_code=201)
def create_visit(
    payload: VisitCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    lead = db.get(Lead, payload.lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead no encontrado.")
    _ensure_lead_access(current_user, lead)

    data = payload.model_dump()
    if not _is_admin_user(current_user):
        # Un asesor siempre queda asignado a su propio perfil.
        advisor = current_user.advisor
        if advisor is None:
            advisor = Advisor(name=current_user.name, email=current_user.email)
            db.add(advisor)
            db.flush()
            current_user.advisor = advisor
        data["advisor_id"] = advisor.id
    elif data.get("advisor_id") is None and current_user.advisor:
        data["advisor_id"] = current_user.advisor.id

    visit = Visit(**data)
    db.add(visit)
    db.flush()
    if lead.status == "new":
        lead.status = "visit_scheduled"
    db.commit()
    db.refresh(visit)
    return VisitOut.model_validate(visit)


@router.patch("/visits/{visit_id}", response_model=VisitOut)
def update_visit(
    visit_id: int,
    payload: VisitUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    visit = db.get(Visit, visit_id)
    if not visit:
        raise HTTPException(status_code=404, detail="Visita no encontrada.")
    _ensure_visit_access(current_user, visit)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(visit, key, value)
    db.commit()
    db.refresh(visit)
    return VisitOut.model_validate(visit)


# ---- Quotes ----

@router.get("/quotes", response_model=list[QuoteOut])
def list_quotes(
    advisor_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(Quote).options(joinedload(Quote.project), joinedload(Quote.lot), joinedload(Quote.advisor))
    if not _is_admin_user(current_user):
        # Los asesores solo ven sus propias cotizaciones, sin importar los filtros enviados.
        q = q.filter(Quote.advisor_id == _scoped_advisor_id(current_user))
    if advisor_id and _is_admin_user(current_user):
        q = q.filter(Quote.advisor_id == advisor_id)
    return [_quote_out(quote) for quote in q.order_by(Quote.created_at.desc()).all()]


@router.post("/quotes", response_model=QuoteOut, status_code=201)
def create_quote(
    payload: QuoteCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    lot = db.get(Lot, payload.lot_id)
    if not lot:
        raise HTTPException(status_code=404, detail="Lote no encontrado.")

    if payload.lead_id:
        lead = db.get(Lead, payload.lead_id)
        if not lead:
            raise HTTPException(status_code=404, detail="Lead no encontrado.")
        _ensure_lead_access(current_user, lead)

    advisor_id = payload.advisor_id
    if not _is_admin_user(current_user):
        advisor = current_user.advisor
        if advisor is None:
            advisor = Advisor(name=current_user.name, email=current_user.email)
            db.add(advisor)
            db.flush()
            current_user.advisor = advisor
        advisor_id = advisor.id
    elif advisor_id is None and current_user.advisor:
        advisor_id = current_user.advisor.id

    # Calculo del precio del lote a partir del precio por m2 (dinámico),
    # recargos por ubicación, descuento y financiamiento.
    quote = Quote(
        lead_id=payload.lead_id,
        advisor_id=advisor_id,
        status="draft",
    )
    values = _apply_quote_values(quote, payload, lot)

    quote.quote_number = _next_quote_number(db)
    db.add(quote)
    db.flush()

    _replace_quote_items(db, quote, lot, values)

    db.commit()
    db.refresh(quote)
    return _quote_out(quote)


@router.patch("/quotes/{quote_id}", response_model=QuoteOut)
def update_quote(
    quote_id: int,
    payload: QuoteUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    quote = db.get(Quote, quote_id)
    if not quote:
        raise HTTPException(status_code=404, detail="Cotización no encontrada.")
    _ensure_quote_access(current_user, quote)

    lot = db.get(Lot, quote.lot_id)
    if not lot:
        raise HTTPException(status_code=404, detail="Lote no encontrado.")

    data = payload.model_dump(exclude_unset=True)

    if "lot_id" in data and data["lot_id"]:
        new_lot = db.get(Lot, data["lot_id"])
        if not new_lot:
            raise HTTPException(status_code=404, detail="Lote no encontrado.")
        lot = new_lot

    if "lead_id" in data and data["lead_id"] is not None:
        lead = db.get(Lead, data["lead_id"])
        if not lead:
            raise HTTPException(status_code=404, detail="Lead no encontrado.")
        _ensure_lead_access(current_user, lead)

    # Los asesores siempre conservan su propia autoría.
    if not _is_admin_user(current_user):
        quote.advisor_id = _scoped_advisor_id(current_user)

    values = _apply_quote_values(quote, payload, lot)
    _replace_quote_items(db, quote, lot, values)

    db.commit()
    db.refresh(quote)
    return _quote_out(quote)


@router.delete("/quotes/{quote_id}", status_code=204)
def delete_quote(
    quote_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    quote = db.get(Quote, quote_id)
    if not quote:
        raise HTTPException(status_code=404, detail="Cotización no encontrada.")
    _ensure_quote_access(current_user, quote)
    db.delete(quote)
    db.commit()


@router.get("/quotes/{quote_id}/pdf")
def generate_quote_pdf_endpoint(
    quote_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    quote = db.get(Quote, quote_id)
    if not quote:
        raise HTTPException(status_code=404, detail="Cotización no encontrada.")
    _ensure_quote_access(current_user, quote)

    # Determinar nombre del cliente
    client_name = quote.client_name or None
    if not client_name and quote.lead and quote.lead.client:
        client_name = f"{quote.lead.client.name} {quote.lead.client.last_name}".strip()
    
    advisor_name = quote.advisor.name if quote.advisor else None
    advisor_phone = (quote.advisor.phone or quote.advisor.whatsapp) if quote.advisor else None

    project_name = quote.project.name if quote.project else "Netland"
    lot_code = quote.lot.code if quote.lot else ""
    
    # Calcular descuento
    discount_amount = 0
    if quote.discount_type == "percentage":
        discount_amount = float(quote.lot_price or 0) * (float(quote.discount_value or 0) / 100)
    elif quote.discount_type == "fixed":
        discount_amount = float(quote.discount_value or 0)

    from fastapi.responses import Response

    # Datos de empresa/editables desde Configuración (con valores por defecto)
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
    company_accounts = [
        line.strip()
        for line in (config.get("company_bank_accounts") or "").splitlines()
        if line.strip()
    ]

    pdf = generate_quote_pdf(
        quote_number=quote.quote_number,
        company_name=settings.APP_NAME,
        company_ruc=config.get("company_ruc") or "20610742468",
        company_razon_social=config.get("company_razon_social")
        or "NETLAND CORPORACION INMOBILIARIA S.A.C.",
        company_address=config.get("company_address")
        or "Urb. Magisterial Mz. B Lote. 3, (cerca al Grifo Primax) - San Vicente de Cañete, Lima, Perú",
        company_accounts=company_accounts,
        project_name=project_name,
        lot_code=lot_code,
        area_m2=float(quote.lot.area_m2) if quote.lot and quote.lot.area_m2 else None,
        lot_price=float(quote.lot_price or 0),
        price_per_m2=float(quote.price_per_m2) if quote.price_per_m2 else None,
        esquina_surcharge=float(quote.esquina_surcharge or 0),
        frente_parque_surcharge=float(quote.frente_parque_surcharge or 0),
        frente_a_pista_surcharge=float(quote.frente_a_pista_surcharge or 0),
        discount_type=quote.discount_type or "none",
        discount_value=float(quote.discount_value or 0),
        discount_amount=discount_amount,
        payment_type=quote.payment_type or "credit",
        initial_payment=float(quote.initial_payment or 0),
        installments=quote.installments or 0,
        installment_value=float(quote.installment_value or 0),
        total_amount=float(quote.total_amount or 0),
        client_name=client_name,
        advisor_name=advisor_name,
        advisor_phone=advisor_phone,
        notes=quote.notes or "",
        date_str=quote.created_at.strftime("%d/%m/%Y") if quote.created_at else datetime.now().strftime("%d/%m/%Y"),
    )
    quote.status = "sent"
    db.commit()
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{quote.quote_number}.pdf"'},
    )


@router.get("/quote-statuses")
def quote_statuses():
    return LEAD_STATUSES