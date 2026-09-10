"""
Servicio de Respaldo y Restauración de la base de datos.

Genera un dump JSON de todas las tablas registradas en la metadata de
SQLAlchemy y lo almacena como archivo raw en Cloudinary (fuera de la
instancia, evitando que un fallo de infraestructura borre los respaldos).

La restauración reinserta los datos respetando las llaves foráneas:
primero elimina en orden inverso (hijos antes que padres) y luego
reinserta en orden de dependencias (padres primero, hijos después),
todo dentro de una única transacción. Si algo falla, se revierte.
"""
import json
import os
import tempfile
from datetime import date, datetime, time
from decimal import Decimal
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import Date, DateTime, Numeric, Time, text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import Base
from app.domain.backup_models import Backup
from app.domain.models import AuditLog
from app.infrastructure.cloudinary_service import delete_file, get_cloudinary, upload_file

BACKUP_VERSION = 1
BACKUP_FOLDER = "backups"
BACKUP_EXTENSION = ".json"

_JSON_PRIMITIVES = (str, int, float, bool)


def _to_json_value(value: Any) -> Any:
    """Convierte un valor de base de datos en una primitiva serializable a JSON."""
    if value is None or isinstance(value, _JSON_PRIMITIVES):
        return value
    if isinstance(value, Decimal):
        # Se conserva como texto para no perder precisión.
        return str(value)
    if isinstance(value, (datetime, date, time)):
        return value.isoformat()
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, bytes):
        return value.hex()
    return str(value)


def _from_json_value(value: Any, column_type: Any) -> Any:
    """Convierte un valor del JSON de vuelta al tipo Python esperado por la columna."""
    if value is None:
        return None

    if isinstance(value, str):
        if isinstance(column_type, DateTime):
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        if isinstance(column_type, Date):
            return date.fromisoformat(value)
        if isinstance(column_type, Time):
            return time.fromisoformat(value)
        if isinstance(column_type, Numeric):
            return Decimal(value)

    return value


def _dump_tables(db: Session) -> Dict[str, List[Dict[str, Any]]]:
    """Serializa todas las tablas del modelo en filas como diccionarios."""
    tables: Dict[str, List[Dict[str, Any]]] = {}
    for table in Base.metadata.sorted_tables:
        tables[table.name] = [
            {
                column.name: _to_json_value(row._mapping[column.name])
                for column in table.columns
            }
            for row in db.execute(table.select())
        ]
    return tables


def _build_payload(tables: Dict[str, List[Dict[str, Any]]]) -> bytes:
    payload = {
        "app": settings.APP_NAME,
        "version": BACKUP_VERSION,
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "tables": tables,
    }
    return json.dumps(payload, ensure_ascii=False).encode("utf-8")


def _store_file(data: bytes) -> Dict[str, str]:
    """Sube el respaldo a Cloudinary como archivo raw."""
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=BACKUP_EXTENSION) as tmp:
            tmp.write(data)
            tmp_path = tmp.name
        try:
            return upload_file(
                tmp_path,
                public_id=f"backup_{datetime.utcnow():%Y%m%d%H%M%S%f}",
                folder=BACKUP_FOLDER,
                resource_type="raw",
            )
        finally:
            os.unlink(tmp_path)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"No se pudo almacenar el respaldo: {exc}",
        )


def _log_audit(db: Session, user_id: Optional[int], action: str, details: str) -> None:
    db.add(
        AuditLog(
            user_id=user_id,
            action=action,
            entity="backups",
            details=details,
        )
    )


def _generate_filename() -> str:
    return f"netland-backup-{datetime.utcnow():%Y%m%d-%H%M%S}{BACKUP_EXTENSION}"


def create_backup(db: Session, user_id: Optional[int]) -> Backup:
    """Genera un respaldo completo y registra sus metadatos."""
    tables = _dump_tables(db)
    total_rows = sum(len(rows) for rows in tables.values())
    data = _build_payload(tables)
    filename = _generate_filename()

    uploaded = _store_file(data)

    backup = Backup(
        user_id=user_id,
        filename=filename,
        public_id=uploaded["public_id"],
        url=uploaded["url"],
        size_bytes=len(data),
        tables_count=len(tables),
        total_rows=total_rows,
    )
    db.add(backup)
    _log_audit(
        db,
        user_id,
        "create_backup",
        f"Respaldo {filename} creado ({total_rows} filas en {len(tables)} tablas).",
    )
    db.commit()
    db.refresh(backup)
    return backup


def _quote(identifier: str) -> str:
    """Escapa un identificador SQL (nombres internos del modelo)."""
    return f'"{identifier}"'


def _resync_sequences(db: Session) -> None:
    """Reajusta las secuencias de las columnas autoincrementales tras el restore."""
    for table in Base.metadata.sorted_tables:
        column = table.autoincrement_column
        if column is None:
            continue
        db.execute(
            text(
                "SELECT setval("
                "pg_get_serial_sequence(:t, :c), "
                f"GREATEST((SELECT COALESCE(MAX({_quote(column.name)}), 1) "
                f"FROM {_quote(table.name)}), 1)"
                ")"
            ),
            {"t": table.name, "c": column.name},
        )


def _parse_payload(raw: bytes) -> Dict[str, List[Dict[str, Any]]]:
    try:
        payload = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo no es un respaldo JSON válido.",
        )

    if payload.get("version") != BACKUP_VERSION:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Versión de respaldo no soportada: {payload.get('version')}.",
        )

    tables = payload.get("tables")
    if not isinstance(tables, dict):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Estructura de respaldo inválida: falta el bloque 'tables'.",
        )

    known = {table.name for table in Base.metadata.sorted_tables}
    unknown = sorted(set(tables) - known)
    if unknown:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El respaldo contiene tablas desconocidas: {', '.join(unknown)}.",
        )

    return tables


def restore_backup(db: Session, user_id: Optional[int], raw: bytes) -> Dict[str, Any]:
    """Restaura la base de datos a partir de un archivo de respaldo.

    Es transaccional: ante cualquier error se revierte y la base de datos
    queda intacta.
    """
    tables = _parse_payload(raw)

    try:
        # Eliminar datos: primero las tablas que dependen de otras (hijos).
        for table in reversed(Base.metadata.sorted_tables):
            db.execute(table.delete())

        # Reinsertar datos: padres antes que hijos para respetar las FKs.
        restored: Dict[str, int] = {}
        for table in Base.metadata.sorted_tables:
            rows = [
                {
                    key: _from_json_value(value, table.c[key].type)
                    for key, value in row.items()
                    if key in table.c and isinstance(key, str)
                }
                for row in tables.get(table.name, [])
                if isinstance(row, dict)
            ]
            if rows:
                db.execute(table.insert(), rows)
            restored[table.name] = len(rows)

        _resync_sequences(db)
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"La restauración falló y se revirtió: {exc}",
        )

    total_rows = sum(restored.values())
    _log_audit(
        db,
        user_id,
        "restore_backup",
        f"Base de datos restaurada ({total_rows} filas en {len(tables)} tablas).",
    )
    db.commit()

    return {"restored_tables": restored, "total_rows": total_rows}


def get_signed_url(backup: Backup) -> str:
    """Devuelve una URL firmada para descargar el respaldo desde Cloudinary."""
    if not backup.public_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El respaldo no tiene archivo asociado.",
        )

    cloudinary = get_cloudinary()
    if not cloudinary:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Cloudinary no está configurado.",
        )

    import cloudinary.utils

    url, _ = cloudinary.utils.cloudinary_url(
        backup.public_id,
        resource_type="raw",
        type="upload",
        sign_url=True,
        secure=True,
    )
    return url


def delete_backup_file(backup: Backup) -> None:
    """Elimina el archivo del respaldo en Cloudinary (best-effort)."""
    if not backup.public_id:
        return
    try:
        delete_file(backup.public_id)
    except RuntimeError:
        # Si Cloudinary no responde se conserva el archivo; el registro
        # de la base de datos puede eliminarse igualmente.
        pass