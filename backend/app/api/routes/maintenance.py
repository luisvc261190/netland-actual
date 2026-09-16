"""
API Routes para mantenimiento / restablecimiento de datos.
Acceso exclusivo para el rol SUPER_ADMIN.
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import require_roles
from app.domain.commission_models import AdvisorCommission, CommissionPayment
from app.domain.models import (
    Advisor,
    AuditLog,
    Client,
    Lead,
    Notification,
    Quote,
    QuoteItem,
    Role,
    SiteAnnouncement,
    User,
    Visit,
)
from app.domain.owners_models import (
    CashPayment,
    Contract,
    ContractDocument,
    FinancingPlan,
    ImportBatch,
    ImportError,
    Installment,
    Owner,
    Payment,
    PaymentAllocation,
    PropertyOwnership,
)

router = APIRouter(prefix="/admin", tags=["mantenimiento"])

require_super_admin = require_roles(Role.SUPER_ADMIN)


class ResetBusinessDataResult(BaseModel):
    message: str
    deleted_rows: int
    deleted_tables: list[dict]


# Tablas de datos de negocio a eliminar, en orden de más específico a más general
# (hijos antes que padres) para respetar las claves foráneas existentes.
# Cada tupla: (modelo, etiqueta legible).
TABLES_TO_DELETE = [
    (PaymentAllocation, "asignaciones de pagos"),
    (Installment, "cuotas"),
    (FinancingPlan, "cronogramas de financiamiento"),
    (CashPayment, "pagos en efectivo"),
    (Payment, "pagos"),
    (ContractDocument, "documentos de contratos"),
    (PropertyOwnership, "propiedades de propietarios"),
    (Contract, "contratos"),
    (ImportError, "errores de importación"),
    (ImportBatch, "lotes de importación"),
    (Owner, "propietarios"),
    (QuoteItem, "detalles de cotizaciones"),
    (Quote, "cotizaciones"),
    (Visit, "visitas"),
    (Lead, "prospectos (leads)"),
    (Client, "clientes"),
    (AdvisorCommission, "comisiones de asesores"),
    (CommissionPayment, "pagos de comisiones"),
    (Advisor, "asesores"),
    (SiteAnnouncement, "anuncios"),
    (AuditLog, "registro de auditoría"),
    (Notification, "notificaciones"),
]


@router.post("/reset-business-data", response_model=ResetBusinessDataResult)
def reset_business_data(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    """Elimina todos los datos de negocio de todos los módulos.

    Se conservan intactos: proyectos, bloques, lotes (con su estado actual),
    usuarios, roles, configuración del sitio y respaldos.

    ⚠️  Acción IRREVERSIBLE. Solo disponible para el rol SUPER_ADMIN.
    """
    deleted_tables: list[dict] = []
    for model, label in TABLES_TO_DELETE:
        count = db.query(model).delete(synchronize_session=False)
        deleted_tables.append({"tabla": label, "eliminados": count})

    total = sum(item["eliminados"] for item in deleted_tables)

    # Registro de la operación para auditoría posterior (se purga el histórico previo).
    db.add(
        AuditLog(
            user_id=current_user.id,
            action="reset_business_data",
            entity="todos_los_datos",
            details=f"Restablecimiento de datos iniciado por {current_user.name}: {total} registros eliminados.",
        )
    )
    db.commit()

    return ResetBusinessDataResult(
        message="Todos los datos de negocio se eliminaron correctamente.",
        deleted_rows=total,
        deleted_tables=deleted_tables,
    )