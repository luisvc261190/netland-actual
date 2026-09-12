import traceback
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)
r = client.post("/api/auth/login/json", json={"email": "admin@netlandcorp.com", "password": "AdminNetland2026"})
print("login", r.status_code)
token = r.json().get("access_token")
headers = {"Authorization": f"Bearer {token}"}

endpoints = [
    "/api/dashboard/summary?period=month",
    "/api/dashboard/summary?period=year&project_id=1",
    "/api/dashboard/trend?range=7d",
    "/api/dashboard/trend?range=30d",
    "/api/dashboard/trend?range=6m",
    "/api/dashboard/trend?range=ytd",
    "/api/dashboard/projects",
    "/api/dashboard/advisors?period=month",
    "/api/dashboard/advisors?period=year",
    "/api/dashboard/funnel",
    "/api/dashboard/leads-by-source",
    "/api/dashboard/leads-by-source?range=6m",
    "/api/dashboard/clients-trend?range=30d",
    "/api/dashboard/clients-trend?range=6m",
    "/api/dashboard/activity",
]
for ep in endpoints:
    try:
        resp = client.get(ep, headers=headers)
        status = resp.status_code
        ok = resp.json() if status == 200 else resp.text[:200]
        print(status, ep, "->", ok if status != 200 else "OK")
    except Exception:
        print("EXC", ep)
        traceback.print_exc()
