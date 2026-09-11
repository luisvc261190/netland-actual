"""
API Routes para el módulo de Anuncios (pop-up de la web pública).
El listado público expone solo anuncios activos y vigentes por fecha.
El CRUD está restringido al administrador del sistema.
"""
from datetime import date
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import require_admin
from app.domain.models import SiteAnnouncement
from app.schemas.announcements import AnnouncementCreate, AnnouncementOut, AnnouncementUpdate

router = APIRouter(prefix="/announcements", tags=["announcements"])


def _get_or_404(db: Session, announcement_id: int) -> SiteAnnouncement:
    announcement = db.get(SiteAnnouncement, announcement_id)
    if not announcement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Anuncio no encontrado.",
        )
    return announcement


@router.get("/active", response_model=List[AnnouncementOut])
def active_announcements(db: Session = Depends(get_db)):
    """Anuncios activos y vigentes según la fecha actual, para el pop-up público."""
    today = date.today()
    rows = (
        db.query(SiteAnnouncement)
        .filter(
            SiteAnnouncement.is_active.is_(True),
            or_(
                SiteAnnouncement.start_date.is_(None),
                SiteAnnouncement.start_date <= today,
            ),
            or_(
                SiteAnnouncement.end_date.is_(None),
                SiteAnnouncement.end_date >= today,
            ),
        )
        .order_by(
            SiteAnnouncement.sort_order.asc(),
            SiteAnnouncement.created_at.desc(),
        )
        .all()
    )
    return [AnnouncementOut.model_validate(row) for row in rows]


@router.get("", response_model=List[AnnouncementOut], dependencies=[Depends(require_admin)])
def list_announcements(db: Session = Depends(get_db)):
    """Todos los anuncios (activos e inactivos), del más reciente al más antiguo."""
    rows = db.query(SiteAnnouncement).order_by(SiteAnnouncement.sort_order.asc(), SiteAnnouncement.created_at.desc()).all()
    return [AnnouncementOut.model_validate(row) for row in rows]


@router.post("", response_model=AnnouncementOut, dependencies=[Depends(require_admin)])
def create_announcement(payload: AnnouncementCreate, db: Session = Depends(get_db)):
    announcement = SiteAnnouncement(**payload.model_dump())
    db.add(announcement)
    db.commit()
    db.refresh(announcement)
    return AnnouncementOut.model_validate(announcement)


@router.put("/{announcement_id}", response_model=AnnouncementOut, dependencies=[Depends(require_admin)])
def update_announcement(
    announcement_id: int,
    payload: AnnouncementUpdate,
    db: Session = Depends(get_db),
):
    announcement = _get_or_404(db, announcement_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(announcement, key, value)
    db.commit()
    db.refresh(announcement)
    return AnnouncementOut.model_validate(announcement)


@router.delete("/{announcement_id}", status_code=204, dependencies=[Depends(require_admin)])
def delete_announcement(announcement_id: int, db: Session = Depends(get_db)):
    announcement = _get_or_404(db, announcement_id)
    db.delete(announcement)
    db.commit()