"""Prueba de integración rápida de la API (usa SQLite local)."""
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

os.environ["DATABASE_URL"] = "sqlite:///./test.db"

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.core.database import SessionLocal  # noqa: E402
from app.domain.models import Client, Lead, Quote, Visit  # noqa: E402

client = TestClient(app)
passed = 0
failed = 0

db = SessionLocal()
db.query(Visit).delete()
db.query(Quote).delete()
db.query(Lead).delete()
db.query(Client).delete()
db.commit()
db.close()


def check(name, condition, extra=""):
    global passed, failed
    if condition:
        passed += 1
        print(f"[PASS] {name}")
    else:
        failed += 1
        print(f"[FAIL] {name} {extra}")


# Health
r = client.get("/health")
check("health", r.status_code == 200)

# Login
r = client.post("/api/auth/login", data={"username": "admin@netlandcorp.com", "password": "AdminNetland2026"})
check("login", r.status_code == 200)
token = r.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

# Public projects
r = client.get("/api/projects?published_only=true")
projects = r.json()
check("projects list", r.status_code == 200 and len(projects) == 2, str(r.status_code))
vds = next((p for p in projects if p["slug"] == "villa-del-sur"), None)
check("villa del sur found", vds is not None)

# Lots of villa del sur
r = client.get("/api/projects/villa-del-sur/lots")
lots = r.json()
check("lots", r.status_code == 200 and len(lots) == 15, str(len(lots)))
available = [l for l in lots if l["status"] == "available"]
reserved = [l for l in lots if l["status"] == "reserved"]
check("available lots", len(available) > 0, str(len(available)))
check("reserved lots", len(reserved) > 0)

# Status transition: reserve an available lot (admin)
lot_to_reserve = available[0]
r = client.patch(
    f"/api/projects/lots/{lot_to_reserve['id']}/status",
    json={"status": "reserved"},
    headers=headers,
)
check("reserve lot", r.status_code == 200 and r.json()["status"] == "reserved", str(r.status_code))

# Double reserve should fail
r = client.patch(
    f"/api/projects/lots/{lot_to_reserve['id']}/status",
    json={"status": "reserved"},
    headers=headers,
)
check("double reserve blocked", r.status_code == 409, str(r.status_code))

# Public lead creation
r = client.post(
    "/api/leads",
    json={
        "name": "Juan",
        "last_name": "Perez",
        "phone": "999888777",
        "project_id": vds["id"],
        "lot_id": lot_to_reserve["id"],
        "message": "Quiero informacion del lote",
    },
)
check("lead created", r.status_code == 201, str(r.status_code))
lead_id = r.json()["id"]

# Admin list leads
r = client.get("/api/leads", headers=headers)
check("list leads", r.status_code == 200 and len(r.json()) == 1, str(r.status_code))

# Quote
r = client.post(
    "/api/quotes",
    json={
        "lead_id": lead_id,
        "project_id": vds["id"],
        "lot_id": lot_to_reserve["id"],
        "initial_payment": 2000,
        "installments": 24,
    },
    headers=headers,
)
check("quote created", r.status_code == 201, str(r.status_code))
quote_id = r.json()["id"]
check("quote calc", r.json()["installment_value"] > 0 and r.json()["total_amount"] > 0)

# Quote PDF
r = client.get(f"/api/quotes/{quote_id}/pdf", headers=headers)
check("quote pdf", r.status_code == 200 and r.content[:4] == b"%PDF", str(r.status_code))

# Dashboard stats
r = client.get("/api/dashboard/stats", headers=headers)
stats = r.json()
check("dashboard", r.status_code == 200 and stats["projects_total"] == 2, str(r.status_code))
check("dashboard lots", stats["lots_total"] == 15 and stats["lots_reserved"] >= 1, str(stats))

# Unauthorized access
r = client.get("/api/dashboard/stats")
check("dashboard requires auth", r.status_code == 401, str(r.status_code))

print(f"\nRESULTADO: {passed} passed, {failed} failed")
if failed:
    raise SystemExit(1)