from datetime import date, datetime
from enum import Enum

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base

# Importar modelos del módulo de propietarios
from app.domain.owners_models import (
    Owner,
    PropertyOwnership,
    Contract,
    CashPayment,
    FinancingPlan,
    Installment,
    Payment,
    PaymentAllocation,
    ContractDocument,
    ImportBatch,
    ImportError,
)


class Role(str, Enum):
    SUPER_ADMIN = "SUPER_ADMIN"
    ADMIN = "ADMIN"
    ASESOR = "ASESOR"
    VENTAS = "VENTAS"
    COBRANZAS = "COBRANZAS"
    SUPERVISOR = "SUPERVISOR"


class LotStatus(str, Enum):
    AVAILABLE = "available"
    RESERVED = "reserved"
    SOLD = "sold"
    NOT_AVAILABLE = "not_available"


class LeadStatus(str, Enum):
    NEW = "new"
    CONTACTED = "contacted"
    INTERESTED = "interested"
    VISIT_SCHEDULED = "visit_scheduled"
    NEGOTIATION = "negotiation"
    RESERVED = "reserved"
    SOLD = "sold"
    DISCARDED = "discarded"


class QuoteStatus(str, Enum):
    DRAFT = "draft"
    SENT = "sent"
    ACCEPTED = "accepted"
    REJECTED = "rejected"


class VisitStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    NO_SHOW = "no_show"


class RoleModel(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True)
    name = Column(String(50), unique=True, nullable=False)

    users = relationship("User", back_populates="role")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=False)
    name = Column(String(120), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    role = relationship("RoleModel", back_populates="users")
    advisor = relationship(
        "Advisor", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True)
    slug = Column(String(120), unique=True, nullable=False, index=True)
    name = Column(String(200), nullable=False)
    short_name = Column(String(80), nullable=False)
    project_type = Column(String(60), nullable=False, default="lotes")
    tagline = Column(String(200), default="")
    description = Column(Text, default="")
    long_description = Column(Text, default="")
    features = Column(Text, default="")
    location = Column(String(200), default="")
    reference = Column(String(255), default="")
    map_link = Column(String(500), default="")
    latitude = Column(Numeric(10, 7), nullable=True)
    longitude = Column(Numeric(10, 7), nullable=True)
    color_primary = Column(String(9), default="#14532d")
    color_secondary = Column(String(9), default="#1e3a5f")
    hero_image = Column(String(500), default="")
    hero_video = Column(String(500), default="")
    logo_url = Column(String(500), default="")
    plan_pdf_url = Column(String(500), default="")  # PDF del plano del proyecto
    status = Column(String(30), default="active")
    is_published = Column(Boolean, default=True, nullable=False)
    legal_info = Column(Text, default="")
    seo_title = Column(String(200), default="")
    seo_description = Column(String(500), default="")
    og_image = Column(String(500), default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    blocks = relationship(
        "Block", back_populates="project", cascade="all, delete-orphan"
    )
    lots = relationship("Lot", back_populates="project", cascade="all, delete-orphan")
    images = relationship(
        "ProjectImage", back_populates="project", cascade="all, delete-orphan"
    )
    videos = relationship(
        "ProjectVideo", back_populates="project", cascade="all, delete-orphan"
    )
    documents = relationship(
        "ProjectDocument", back_populates="project", cascade="all, delete-orphan"
    )
    promotions = relationship(
        "Promotion", back_populates="project", cascade="all, delete-orphan"
    )


class Block(Base):
    __tablename__ = "blocks"

    id = Column(Integer, primary_key=True)
    project_id = Column(
        Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    code = Column(String(10), nullable=False)
    name = Column(String(120), default="")
    sort_order = Column(Integer, default=0)

    project = relationship("Project", back_populates="blocks")
    lots = relationship("Lot", back_populates="block")

    __table_args__ = (
        UniqueConstraint("project_id", "code", name="uq_block_project_code"),
    )


class Lot(Base):
    __tablename__ = "lots"

    id = Column(Integer, primary_key=True)
    project_id = Column(
        Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    block_id = Column(Integer, ForeignKey("blocks.id", ondelete="SET NULL"), nullable=True)
    code = Column(String(30), nullable=False)
    lot_number = Column(Integer, nullable=True)
    area_m2 = Column(Numeric(10, 2), nullable=True)
    price_per_m2 = Column(Numeric(12, 2), nullable=True)
    price = Column(Numeric(12, 2), nullable=True)
    promo_price = Column(Numeric(12, 2), nullable=True)
    status = Column(String(20), default="available", nullable=False)
    x = Column(Numeric(10, 2), nullable=True)
    y = Column(Numeric(10, 2), nullable=True)
    width = Column(Numeric(10, 2), nullable=True)
    height = Column(Numeric(10, 2), nullable=True)
    notes = Column(Text, default="")
    # Campos adicionales del Excel
    zone = Column(String(100), nullable=True)  # ZONA (COMERCIAL, RESIDENCIAL, etc.)
    location_bonus = Column(String(255), nullable=True)  # PLUS POR UBICACIÓN
    location_bonus_amount = Column(Numeric(12, 2), nullable=True)  # Precio extra por ubicación
    normal_price_usd = Column(Numeric(12, 2), nullable=True)  # Precio normal US $
    normal_price_soles = Column(Numeric(12, 2), nullable=True)  # Precio Normal S/
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    project = relationship("Project", back_populates="lots")
    block = relationship("Block", back_populates="lots")
    leads = relationship("Lead", back_populates="lot")
    quotes = relationship("Quote", back_populates="lot")

    __table_args__ = (
        Index("ix_lots_project_status", "project_id", "status"),
        UniqueConstraint("project_id", "code", name="uq_lot_project_code"),
    )


class ProjectImage(Base):
    __tablename__ = "project_images"

    id = Column(Integer, primary_key=True)
    project_id = Column(
        Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    url = Column(String(500), nullable=False)
    public_id = Column(String(255), default="")
    caption = Column(String(255), default="")
    category = Column(String(60), default="gallery")
    sort_order = Column(Integer, default=0)
    is_cover = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    project = relationship("Project", back_populates="images")


class ProjectVideo(Base):
    __tablename__ = "project_videos"

    id = Column(Integer, primary_key=True)
    project_id = Column(
        Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    url = Column(String(500), nullable=False)
    public_id = Column(String(255), default="")
    title = Column(String(255), default="")
    video_type = Column(String(60), default="promotional")
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    project = relationship("Project", back_populates="videos")


class ProjectDocument(Base):
    __tablename__ = "project_documents"

    id = Column(Integer, primary_key=True)
    project_id = Column(
        Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    name = Column(String(255), nullable=False)
    category = Column(String(80), default="brochure")
    url = Column(String(500), nullable=False)
    public_id = Column(String(255), default="")
    description = Column(Text, default="")
    is_published = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    project = relationship("Project", back_populates="documents")


class Promotion(Base):
    __tablename__ = "promotions"

    id = Column(Integer, primary_key=True)
    project_id = Column(
        Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    name = Column(String(200), nullable=False)
    description = Column(Text, default="")
    old_price = Column(Numeric(12, 2), nullable=True)
    promo_price = Column(Numeric(12, 2), nullable=True)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    project = relationship("Project", back_populates="promotions")


class Advisor(Base):
    __tablename__ = "advisors"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    name = Column(String(120), nullable=False)
    role_title = Column(String(120), default="Asesor Inmobiliario")
    photo_url = Column(String(500), default="")
    phone = Column(String(30), default="")
    whatsapp = Column(String(30), default="")
    email = Column(String(255), default="")
    project_ids = Column(String(255), default="")
    is_available = Column(Boolean, default=True)
    bio = Column(Text, default="")
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="advisor")
    leads = relationship("Lead", back_populates="advisor")
    visits = relationship("Visit", back_populates="advisor")


class Client(Base):
    __tablename__ = "clients"

    id = Column(Integer, primary_key=True)
    name = Column(String(120), nullable=False)
    last_name = Column(String(120), default="")
    phone = Column(String(30), default="")
    whatsapp = Column(String(30), default="")
    email = Column(String(255), default="")
    notes = Column(Text, default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    leads = relationship("Lead", back_populates="client")


class Lead(Base):
    __tablename__ = "leads"

    id = Column(Integer, primary_key=True)
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="CASCADE"))
    project_id = Column(
        Integer, ForeignKey("projects.id", ondelete="SET NULL"), nullable=True
    )
    lot_id = Column(Integer, ForeignKey("lots.id", ondelete="SET NULL"), nullable=True)
    advisor_id = Column(Integer, ForeignKey("advisors.id", ondelete="SET NULL"), nullable=True)
    status = Column(String(20), default="new", nullable=False)
    budget = Column(Numeric(12, 2), nullable=True)
    source = Column(String(60), default="web")
    message = Column(Text, default="")
    follow_up = Column(Text, default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    client = relationship("Client", back_populates="leads")
    project = relationship("Project")
    lot = relationship("Lot", back_populates="leads")
    advisor = relationship("Advisor", back_populates="leads")
    visits = relationship("Visit", back_populates="lead")
    quotes = relationship("Quote", back_populates="lead")

    __table_args__ = (Index("ix_leads_status", "status"),)


class Visit(Base):
    __tablename__ = "visits"

    id = Column(Integer, primary_key=True)
    lead_id = Column(Integer, ForeignKey("leads.id", ondelete="CASCADE"))
    advisor_id = Column(Integer, ForeignKey("advisors.id", ondelete="SET NULL"))
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="SET NULL"))
    scheduled_at = Column(DateTime(timezone=True), nullable=False)
    status = Column(String(20), default="pending")
    notes = Column(Text, default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    lead = relationship("Lead", back_populates="visits")
    advisor = relationship("Advisor", back_populates="visits")
    project = relationship("Project")


class Quote(Base):
    __tablename__ = "quotes"

    id = Column(Integer, primary_key=True)
    quote_number = Column(String(30), unique=True, nullable=False)
    lead_id = Column(Integer, ForeignKey("leads.id", ondelete="SET NULL"), nullable=True)
    advisor_id = Column(Integer, ForeignKey("advisors.id", ondelete="SET NULL"), nullable=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="SET NULL"))
    lot_id = Column(Integer, ForeignKey("lots.id", ondelete="SET NULL"), nullable=True)
    lot_price = Column(Numeric(12, 2), nullable=True)
    # Precio por m2 y recargos de ubicación
    price_per_m2 = Column(Numeric(12, 2), nullable=True)
    esquina_surcharge = Column(Numeric(12, 2), nullable=True)
    frente_parque_surcharge = Column(Numeric(12, 2), nullable=True)
    frente_a_pista_surcharge = Column(Numeric(12, 2), nullable=True)
    # Campos de descuento
    discount_type = Column(String(20), default="none")  # none, percentage, fixed
    discount_value = Column(Numeric(12, 2), default=0)
    # Campos de pago
    payment_type = Column(String(20), default="credit")  # cash, credit
    initial_payment = Column(Numeric(12, 2), default=0)
    installments = Column(Integer, default=12)
    installment_value = Column(Numeric(12, 2), nullable=True)
    total_amount = Column(Numeric(12, 2), nullable=True)
    # Datos del cliente (para cotizaciones sin lead)
    client_name = Column(String(255), default="")
    client_phone = Column(String(30), default="")
    client_email = Column(String(255), default="")
    # Otros
    notes = Column(Text, default="")
    status = Column(String(20), default="draft")
    pdf_url = Column(String(500), default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    lead = relationship("Lead", back_populates="quotes")
    advisor = relationship("Advisor")
    project = relationship("Project")
    lot = relationship("Lot", back_populates="quotes")
    items = relationship(
        "QuoteItem", back_populates="quote", cascade="all, delete-orphan"
    )


class QuoteItem(Base):
    __tablename__ = "quote_items"

    id = Column(Integer, primary_key=True)
    quote_id = Column(
        Integer, ForeignKey("quotes.id", ondelete="CASCADE"), nullable=False
    )
    description = Column(String(255), default="")
    amount = Column(Numeric(12, 2), default=0)

    quote = relationship("Quote", back_populates="items")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    type = Column(String(40), default="info")
    title = Column(String(200), nullable=False)
    message = Column(Text, default="")
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action = Column(String(60), nullable=False)
    entity = Column(String(60), nullable=False)
    entity_id = Column(Integer, nullable=True)
    details = Column(Text, default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class SiteConfig(Base):
    __tablename__ = "site_config"

    id = Column(Integer, primary_key=True)
    key = Column(String(80), unique=True, nullable=False)
    value = Column(Text, default="")
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())