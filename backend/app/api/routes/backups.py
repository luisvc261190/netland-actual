"""
API Routes para el módulo de Respaldo de Datos.
Acceso exclusivo para el rol SUPER_ADMIN.
"""
from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import require_roles
from app.domain.backup_models import Backup
from app.domain.models import AuditLog, Role, User
from app.infrastructure.backup_service import (
    create_backup,
    delete_backup_file,
    get_signed_url,
    restore_backup,
)
from app.schemas.backups import BackupDetail, BackupRestoreResult, BackupSummary

router = APIRouter(prefix="/backups", tags=["backups"])

require_super_admin = require_roles(Role.SUPER_ADMIN)


def _to_summary(backup: Backup, created_by: str | None = None) -> BackupSummary:
    return BackupSummary(
        id=backup.id,
        filename=backup.filename,
        size_bytes=backup.size_bytes,
        tables_count=backup.tables_count,
        total_rows=backup.total_rows,
        status=backup.status,
        created_at=backup.created_at,
        created_by=created_by,
    )


@router.get("", response_model=List[BackupSummary])
def list_backups(
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    """Lista todos los respaldos registrados, del más reciente al más antiguo."""
    backups = (
        db.query(Backup).order_by(Backup.created_at.desc()).all()
    )
    user_ids = {b.user_id for b in backups if b.user_id}
    names = {
        user.id: user.name
        for user in db.query(User).filter(User.id.in_(user_ids)).all()
    } if user_ids else {}

    return [_to_summary(b, names.get(b.user_id)) for b in backups]


@router.post("", response_model=BackupDetail)
def create(
    db: Session = Depends(get_db),
    user: User = Depends(require_super_admin),
):
    """Genera un respaldo completo del sistema y lo almacena en Cloudinary."""
    backup = create_backup(db, user.id)
    return BackupDetail(
        **_to_summary(backup, user.name).model_dump(),
        url=get_signed_url(backup),
    )


@router.get("/{backup_id}", response_model=BackupDetail)
def detail(
    backup_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_super_admin),
):
    """Devuelve los detalles de un respaldo y su URL firmada de descarga."""
    backup = db.get(Backup, backup_id)
    if not backup:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Respaldo no encontrado.",
        )
    return BackupDetail(
        **_to_summary(backup, user.name).model_dump(),
        url=get_signed_url(backup),
    )


@router.delete("/{backup_id}")
def delete(
    backup_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_super_admin),
):
    """Elimina un respaldo (archivo en Cloudinary y su registro)."""
    backup = db.get(Backup, backup_id)
    if not backup:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Respaldo no encontrado.",
        )

    delete_backup_file(backup)
    db.delete(backup)
    db.add(
        AuditLog(
            user_id=user.id,
            action="delete_backup",
            entity="backups",
            details=f"Respaldo {backup.filename} eliminado.",
        )
    )
    db.commit()

    return {"message": "Respaldo eliminado."}


@router.post("/restore", response_model=BackupRestoreResult)
def restore(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_super_admin),
):
    """Restaura la base de datos completa a partir de un archivo de respaldo.

    ⚠️  Reemplaza todos los datos actuales por los contenidos en el archivo.
    """
    raw = file.file.read()
    if not raw:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo está vacío.",
        )
    return restore_backup(db, user.id, raw)