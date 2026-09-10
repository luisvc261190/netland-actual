from fastapi import APIRouter

from app.api.routes import (
    auth,
    backups,
    collections,
    config,
    contracts,
    crm,
    dashboard,
    excel_import,
    imports,
    installments,
    owners,
    payments,
    plan_import,
    projects,
    sales,
    uploads,
    users,
)

api_router = APIRouter(prefix="/api")
api_router.include_router(auth.router)
api_router.include_router(projects.router)
api_router.include_router(crm.router)
api_router.include_router(users.router)
api_router.include_router(dashboard.router)
api_router.include_router(config.router)
api_router.include_router(uploads.router)
api_router.include_router(excel_import.router)
api_router.include_router(excel_import.template_router)
api_router.include_router(plan_import.router)
# Módulo de Propietarios y Cobranzas
api_router.include_router(owners.router)
api_router.include_router(contracts.router)
api_router.include_router(payments.router)
api_router.include_router(collections.router)
# Importación/exportación masiva
api_router.include_router(imports.router)
# Cuotas del cronograma
api_router.include_router(installments.router)
# Módulo de Ventas
api_router.include_router(sales.router)
# Módulo de Respaldos (solo SUPER_ADMIN)
api_router.include_router(backups.router)