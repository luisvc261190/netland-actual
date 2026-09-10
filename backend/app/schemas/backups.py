"""Schemas Pydantic para el módulo de Respaldo de Datos."""

from datetime import datetime
from typing import Dict, Optional

from pydantic import BaseModel, ConfigDict


class BackupSummary(BaseModel):
    """Resumen de un respaldo para listados."""

    id: int
    filename: str
    size_bytes: int
    tables_count: int
    total_rows: int
    status: str
    created_at: datetime
    created_by: Optional[str] = None


class BackupDetail(BackupSummary):
    """Respaldo con URL firmada para descarga."""

    url: str


class BackupRestoreResult(BaseModel):
    """Resultado de una restauración exitosa."""

    restored_tables: Dict[str, int]
    total_rows: int