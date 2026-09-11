"""Schemas Pydantic para el módulo de Anuncios (pop-up de la web pública)."""

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class AnnouncementCreate(BaseModel):
    title: str
    description: str = ""
    kind: str = "announcement"
    media_type: str = "image"
    image_url: str = ""
    button_phone: str = ""
    is_active: bool = True
    once_per_session: bool = False
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    sort_order: int = 0


class AnnouncementUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    kind: Optional[str] = None
    media_type: Optional[str] = None
    image_url: Optional[str] = None
    button_phone: Optional[str] = None
    is_active: Optional[bool] = None
    once_per_session: Optional[bool] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    sort_order: Optional[int] = None


class AnnouncementOut(BaseModel):
    id: int
    title: str
    description: str
    kind: str
    media_type: str
    image_url: str
    button_phone: str
    is_active: bool
    once_per_session: bool
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    sort_order: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)