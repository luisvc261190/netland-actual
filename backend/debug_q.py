import traceback
from sqlalchemy import func
from app.core.database import SessionLocal
from app.domain.models import Lead

db = SessionLocal()
try:
    q = db.query(Lead)
    rows = (
        q.with_entities(
            func.coalesce(Lead.source, "otro").label("source"),
            func.count(Lead.id),
        )
        .group_by(func.coalesce(Lead.source, "otro"))
        .order_by(func.count(Lead.id).desc())
        .all()
    )
    print("OK", rows)
except Exception:
    traceback.print_exc()
finally:
    db.close()
