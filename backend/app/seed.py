"""Script de inicialización de la base de datos.

Crea roles, usuario administrador, proyectos base (Villa del Sur y Villa Real),
lotes del condominio campestre y el asesor principal Luis Valle.

Uso:
    python -m app.seed
"""
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import Base, SessionLocal, engine
from app.core.security import hash_password
from app.domain.models import (
    Advisor,
    Block,
    Lot,
    Project,
    RoleModel,
    User,
)

PROJECTS = [
    {
        "slug": "villa-del-sur",
        "name": "Condominio Campestre Villa del Sur",
        "short_name": "Villa del Sur",
        "project_type": "condominio_campestre",
        "tagline": "El lugar donde mereces vivir",
        "description": (
            "Condominio campestre en Almenares, Cañete, a aproximadamente 7 minutos de la "
            "Plaza de Armas de Imperial. Lotes para vivienda e inversión en un entorno natural "
            "pensado para familias, con clubhouse y proyección de crecimiento."
        ),
        "long_description": (
            "Villa del Sur es un condominio campestre diseñado para familias que buscan "
            "calidad de vida, seguridad y tranquilidad. Ubicado en Almenares, Cañete, a "
            "aproximadamente 7 minutos de la Plaza de Armas de Imperial, combina un entorno "
            "natural privilegiado con la cercanía a los servicios de la ciudad. Cuenta con "
            "clubhouse y áreas pensadas para la convivencia familiar, además de lotes con "
            "excelente proyección de crecimiento para inversión."
        ),
        "features": (
            "Clubhouse\nEntorno natural\nLotes para inversión\nLotes para vivienda\nEspacio pensado para familias\nProyección de crecimiento"
        ),
        "location": "Almenares, Cañete",
        "reference": "A aproximadamente 7 minutos de la Plaza de Armas de Imperial.",
        "color_primary": "#14532d",
        "color_secondary": "#0f3d2e",
        "status": "active",
        "is_published": True,
        "seo_title": "Condominio Campestre Villa del Sur | Netland Cañete",
        "seo_description": "Lotes en condominio campestre en Almenares, Cañete. A 7 minutos de la Plaza de Armas de Imperial. Vivienda e inversión con respaldo de Netland.",
    },
    {
        "slug": "villa-real",
        "name": "Urbanización Villa Real",
        "short_name": "Villa Real",
        "project_type": "urbanizacion",
        "tagline": "Tu oportunidad de inversión",
        "description": (
            "Urbanización en la Panamericana Sur Km 148, frente al restaurante Urpicha, "
            "a aproximadamente 10 minutos de la Plaza de Armas de San Vicente. Ubicación "
            "estratégica, accesibilidad y oportunidad de inversión."
        ),
        "long_description": (
            "Villa Real es una urbanización con ubicación estratégica sobre la Panamericana "
            "Sur Km 148, frente al restaurante Urpicha y a aproximadamente 10 minutos de la "
            "Plaza de Armas de San Vicente. Su accesibilidad la convierte en una excelente "
            "oportunidad de inversión, con lotes disponibles y promociones especiales."
        ),
        "features": (
            "Ubicación estratégica\nAccesibilidad\nProyecto urbano\nOportunidad de inversión\nLotes disponibles\nPromociones"
        ),
        "location": "Panamericana Sur Km 148, San Vicente",
        "reference": "Frente al restaurante Urpicha. Aproximadamente 10 minutos de la Plaza de Armas de San Vicente.",
        "color_primary": "#1e3a5f",
        "color_secondary": "#16294a",
        "status": "active",
        "is_published": True,
        "seo_title": "Urbanización Villa Real | Netland Cañete",
        "seo_description": "Lotes en urbanización sobre la Panamericana Sur Km 148. Ubicación estratégica, accesibilidad y oportunidad de inversión con Netland.",
    },
]

VILLA_DEL_SUR_LOTS = [
    ("A", 1, 105, 12000, None),
    ("A", 2, 105, 12000, None),
    ("A", 3, 105, 12000, 11200),
    ("A", 4, 120, 13500, None),
    ("A", 5, 105, 12000, None),
    ("A", 6, 105, 12000, None),
    ("B", 1, 105, 11500, 10900),
    ("B", 2, 105, 11500, None),
    ("B", 3, 120, 13000, None),
    ("B", 4, 105, 11500, None),
    ("B", 5, 105, 11500, None),
    ("C", 1, 105, 11800, None),
    ("C", 2, 120, 13200, None),
    ("C", 3, 105, 11800, 11000),
    ("C", 4, 105, 11800, None),
]

VILLA_DEL_SUR_STATUS = {
    ("A", 5): "reserved",
    ("B", 2): "sold",
    ("B", 3): "reserved",
}


def _seed_project(db: Session, project_data: dict) -> Project:
    existing = db.query(Project).filter(Project.slug == project_data["slug"]).first()
    if existing:
        return existing
    project = Project(**project_data)
    db.add(project)
    db.flush()
    return project


def run() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # Roles
        roles = {}
        for role_name in ("SUPER_ADMIN", "ADMIN", "ASESOR", "VENTAS", "COBRANZAS", "SUPERVISOR"):
            role = db.query(RoleModel).filter(RoleModel.name == role_name).first()
            if not role:
                role = RoleModel(name=role_name)
                db.add(role)
                db.flush()
            roles[role_name] = role

        # Usuario administrador
        admin = db.query(User).filter(User.email == settings.SEED_ADMIN_EMAIL).first()
        if not admin:
            admin = User(
                name=settings.SEED_ADMIN_NAME,
                email=settings.SEED_ADMIN_EMAIL,
                password_hash=hash_password(settings.SEED_ADMIN_PASSWORD),
                role_id=roles["SUPER_ADMIN"].id,
            )
            db.add(admin)
            db.flush()

        # Asesor principal
        advisor = db.query(Advisor).filter(Advisor.whatsapp == "51985928062").first()
        if not advisor:
            advisor = Advisor(
                name="Luis Valle",
                role_title="Asesor Inmobiliario",
                whatsapp="51985928062",
                phone="985928062",
                email="luis@netlandcorp.com",
                is_available=True,
                bio="Asesor inmobiliario de Netland Corporación Inmobiliaria. Acompaña a cada cliente desde la primera consulta hasta la entrega de su lote.",
                project_ids="",
            )
            db.add(advisor)
            db.flush()
            admin.advisor = advisor

        # Proyectos
        villa_del_sur = _seed_project(db, PROJECTS[0])
        _seed_project(db, PROJECTS[1])
        db.flush()

        # Lotes de Villa del Sur
        existing_lots = db.query(Lot).filter(Lot.project_id == villa_del_sur.id).count()
        if existing_lots == 0:
            for block_code, number, area, price, promo in VILLA_DEL_SUR_LOTS:
                block = db.query(Block).filter(
                    Block.project_id == villa_del_sur.id, Block.code == block_code
                ).first()
                if not block:
                    block = Block(project_id=villa_del_sur.id, code=block_code, name=f"Manzana {block_code}")
                    db.add(block)
                    db.flush()
                code = f"MZ {block_code} - LT {number:02d}"
                status = VILLA_DEL_SUR_STATUS.get((block_code, number), "available")
                db.add(
                    Lot(
                        project_id=villa_del_sur.id,
                        block_id=block.id,
                        code=code,
                        lot_number=number,
                        area_m2=area,
                        price=price,
                        promo_price=promo,
                        status=status,
                    )
                )

        db.commit()
        print("[OK] Seed completado correctamente.")
        print(f"  Admin: {settings.SEED_ADMIN_EMAIL} / {settings.SEED_ADMIN_PASSWORD}")
        print("  Asesor: Luis Valle - WhatsApp 985 928 062")
    finally:
        db.close()


if __name__ == "__main__":
    run()