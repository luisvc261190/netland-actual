"""Modelos de dominio del módulo de Respaldo de Datos."""

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func

from app.core.database import Base


class Backup(Base):
    """Registro de un respaldo completo de la base de datos.

    El archivo generado se almacena en Cloudinary (fuera de la instancia)
    para garantizar que sobreviva a fallas de infraestructura.
    """

    __tablename__ = "backups"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    filename = Column(String(255), nullable=False)
    public_id = Column(String(255), default="")
    url = Column(String(500), default="")
    size_bytes = Column(Integer, default=0)
    tables_count = Column(Integer, default=0)
    total_rows = Column(Integer, default=0)
    status = Column(String(20), default="completed")
    notes = Column(Text, default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now())