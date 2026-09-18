from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import settings

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=300,
    pool_size=15,
    max_overflow=5,
    pool_timeout=10,
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


# Columnas nuevas añadidas por evolución del esquema (sin Alembic).
# Se agregan de forma idempotente con ALTER TABLE cuando faltan.
_COLUMN_MIGRATIONS = [
    ("payments", "late_interest_amount", "NUMERIC(12,2) NOT NULL DEFAULT 0"),
    ("payments", "late_interest_days", "INTEGER NOT NULL DEFAULT 0"),
    ("payments", "late_interest_waived", "BOOLEAN NOT NULL DEFAULT FALSE"),
    ("payment_allocations", "late_days", "INTEGER NOT NULL DEFAULT 0"),
    ("payment_allocations", "late_interest", "NUMERIC(12,2) NOT NULL DEFAULT 0"),
    ("projects", "bank_accounts", "JSON NOT NULL DEFAULT '[]'"),
    ("contract_documents", "payment_id", "INTEGER NULL"),
]


def ensure_column_migrations() -> None:
    """Agrega columnas de esquema que aún no existan en la base de datos."""
    insp = inspect(engine)
    existing_tables = set(insp.get_table_names())
    table_columns = {
        t: {c["name"] for c in insp.get_columns(t)}
        for t in existing_tables
    }
    with engine.begin() as conn:
        for table, column, ddl in _COLUMN_MIGRATIONS:
            if table in table_columns and column not in table_columns[table]:
                conn.execute(text(f'ALTER TABLE "{table}" ADD COLUMN "{column}" {ddl}'))


def get_db():
    """Dependency de FastAPI que provee una sesión de base de datos."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()