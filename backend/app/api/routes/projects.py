from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload
import httpx

from app.core.database import get_db
from app.core.dependencies import require_admin, require_roles, get_current_user
from app.domain.models import Block, Lot, Project, ProjectDocument, ProjectImage, ProjectVideo, User
from app.schemas.project import (
    BlockCreate,
    BlockOut,
    BlockUpdate,
    DocumentCreate,
    DocumentUpdate,
    GalleryCreate,
    GalleryItem,
    LotCreate,
    LotOut,
    LotStatusUpdate,
    LotUpdate,
    ProjectCreate,
    ProjectOut,
    ProjectUpdate,
    VideoCreate,
)

router = APIRouter(prefix="/projects", tags=["projects"])


def _project_out(project: Project, db: Session) -> ProjectOut:
    out = ProjectOut.model_validate(project)
    out.blocks_count = db.query(func.count(Block.id)).filter(Block.project_id == project.id).scalar() or 0
    out.lots_count = db.query(func.count(Lot.id)).filter(Lot.project_id == project.id).scalar() or 0
    out.available_count = (
        db.query(func.count(Lot.id))
        .filter(Lot.project_id == project.id, Lot.status == "available")
        .scalar()
        or 0
    )
    return out


def get_project_or_404(db: Session, project_id: int | str) -> Project:
    if isinstance(project_id, int) or str(project_id).isdigit():
        project = db.get(Project, int(project_id))
    else:
        project = db.query(Project).filter(Project.slug == str(project_id)).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proyecto no encontrado.")
    return project


@router.get("", response_model=list[ProjectOut])
def list_projects(
    published_only: bool = Query(default=False),
    search: str | None = None,
    db: Session = Depends(get_db),
):
    q = db.query(Project)
    if published_only:
        q = q.filter(Project.is_published.is_(True))
    if search:
        q = q.filter(Project.name.ilike(f"%{search}%"))
    projects = q.order_by(Project.id.asc()).all()
    return [_project_out(p, db) for p in projects]


@router.get("/{project_identifier}", response_model=ProjectOut)
def get_project(project_identifier: str, db: Session = Depends(get_db)):
    project = get_project_or_404(db, project_identifier)
    return _project_out(project, db)


@router.post("", response_model=ProjectOut, dependencies=[Depends(require_admin)])
def create_project(payload: ProjectCreate, db: Session = Depends(get_db)):
    if db.query(Project).filter(Project.slug == payload.slug).first():
        raise HTTPException(status_code=400, detail="Ya existe un proyecto con ese slug.")
    project = Project(**payload.model_dump())
    db.add(project)
    db.commit()
    db.refresh(project)
    return _project_out(project, db)


@router.put("/{project_id}", response_model=ProjectOut, dependencies=[Depends(require_admin)])
def update_project(project_id: int, payload: ProjectUpdate, db: Session = Depends(get_db)):
    project = get_project_or_404(db, project_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(project, key, value)
    db.commit()
    db.refresh(project)
    return _project_out(project, db)


@router.delete("/{project_id}", status_code=204, dependencies=[Depends(require_admin)])
def delete_project(project_id: int, db: Session = Depends(get_db)):
    project = get_project_or_404(db, project_id)
    db.delete(project)
    db.commit()


# ---- Lots ----

@router.get("/{project_identifier}/lots", response_model=list[LotOut])
def list_project_lots(
    project_identifier: str,
    status_filter: str | None = Query(default=None, alias="status"),
    block_id: int | None = None,
    db: Session = Depends(get_db),
):
    project = get_project_or_404(db, project_identifier)
    q = db.query(Lot).filter(Lot.project_id == project.id)
    if status_filter:
        q = q.filter(Lot.status == status_filter)
    if block_id:
        q = q.filter(Lot.block_id == block_id)
    lots = q.order_by(Lot.block_id, Lot.lot_number, Lot.code).all()
    result = []
    for lot in lots:
        out = LotOut.model_validate(lot)
        out.block_code = lot.block.code if lot.block else None
        result.append(out)
    return result


# ---- Blocks ----

@router.get("/{project_identifier}/blocks", response_model=list[BlockOut])
def list_project_blocks(project_identifier: str, db: Session = Depends(get_db)):
    project = get_project_or_404(db, project_identifier)
    blocks = db.query(Block).filter(Block.project_id == project.id).order_by(Block.sort_order).all()
    result = []
    for block in blocks:
        out = BlockOut.model_validate(block)
        out.lots_count = db.query(func.count(Lot.id)).filter(Lot.block_id == block.id).scalar() or 0
        result.append(out)
    return result


@router.post("/blocks", response_model=BlockOut, dependencies=[Depends(require_admin)])
def create_block(payload: BlockCreate, db: Session = Depends(get_db)):
    get_project_or_404(db, payload.project_id)
    if db.query(Block).filter(Block.project_id == payload.project_id, Block.code == payload.code).first():
        raise HTTPException(status_code=400, detail="Ya existe una manzana con ese código en el proyecto.")
    block = Block(**payload.model_dump())
    db.add(block)
    db.commit()
    db.refresh(block)
    return BlockOut.model_validate(block)


@router.put("/blocks/{block_id}", response_model=BlockOut, dependencies=[Depends(require_admin)])
def update_block(block_id: int, payload: BlockUpdate, db: Session = Depends(get_db)):
    block = db.get(Block, block_id)
    if not block:
        raise HTTPException(status_code=404, detail="Manzana no encontrada.")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(block, key, value)
    db.commit()
    db.refresh(block)
    return BlockOut.model_validate(block)


@router.delete("/blocks/{block_id}", status_code=204, dependencies=[Depends(require_admin)])
def delete_block(block_id: int, db: Session = Depends(get_db)):
    block = db.get(Block, block_id)
    if not block:
        raise HTTPException(status_code=404, detail="Manzana no encontrada.")
    db.delete(block)
    db.commit()


# ---- Lots CRUD (admin) ----

@router.post("/lots", response_model=LotOut, dependencies=[Depends(require_admin)])
def create_lot(payload: LotCreate, db: Session = Depends(get_db)):
    get_project_or_404(db, payload.project_id)
    if payload.block_id:
        db.get(Block, payload.block_id)
    lot = Lot(**payload.model_dump())
    db.add(lot)
    db.commit()
    db.refresh(lot)
    return LotOut.model_validate(lot)


@router.put("/lots/{lot_id}", response_model=LotOut, dependencies=[Depends(require_admin)])
def update_lot(lot_id: int, payload: LotUpdate, db: Session = Depends(get_db)):
    lot = db.get(Lot, lot_id)
    if not lot:
        raise HTTPException(status_code=404, detail="Lote no encontrado.")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(lot, key, value)
    db.commit()
    db.refresh(lot)
    out = LotOut.model_validate(lot)
    out.block_code = lot.block.code if lot.block else None
    return out


@router.delete("/lots/{lot_id}", status_code=204, dependencies=[Depends(require_admin)])
def delete_lot(lot_id: int, db: Session = Depends(get_db)):
    lot = db.get(Lot, lot_id)
    if not lot:
        raise HTTPException(status_code=404, detail="Lote no encontrado.")
    db.delete(lot)
    db.commit()


@router.patch("/lots/{lot_id}/status", response_model=LotOut, dependencies=[Depends(get_current_user)])
def update_lot_status(lot_id: int, payload: LotStatusUpdate, db: Session = Depends(get_db)):
    """Cambio de estado transaccional con validación anti-doble-reserva."""
    allowed = {"available", "reserved", "sold", "not_available"}
    if payload.status not in allowed:
        raise HTTPException(status_code=400, detail="Estado de lote inválido.")
    lot = db.query(Lot).with_for_update().get(lot_id)
    if not lot:
        raise HTTPException(status_code=404, detail="Lote no encontrado.")

    if payload.status == "reserved" and lot.status == "reserved":
        raise HTTPException(
            status_code=409,
            detail="Este lote ya fue reservado. No se puede reservar dos veces el mismo lote.",
        )
    if lot.status == "sold" and payload.status != "sold":
        raise HTTPException(
            status_code=409,
            detail="Un lote vendido no puede cambiar de estado.",
        )

    lot.status = payload.status
    db.commit()
    db.refresh(lot)
    out = LotOut.model_validate(lot)
    out.block_code = lot.block.code if lot.block else None
    return out


# ---- Gallery ----

@router.get("/{project_identifier}/gallery", response_model=list[GalleryItem])
def list_gallery(project_identifier: str, db: Session = Depends(get_db)):
    project = get_project_or_404(db, project_identifier)
    images = db.query(ProjectImage).filter(ProjectImage.project_id == project.id).order_by(ProjectImage.sort_order).all()
    return [GalleryItem.model_validate(img) for img in images]


@router.post("/gallery", response_model=GalleryItem, dependencies=[Depends(require_admin)])
def add_gallery_item(payload: GalleryCreate, db: Session = Depends(get_db)):
    get_project_or_404(db, payload.project_id)
    image = ProjectImage(**payload.model_dump())
    db.add(image)
    db.commit()
    db.refresh(image)
    return GalleryItem.model_validate(image)


@router.delete("/gallery/{image_id}", status_code=204, dependencies=[Depends(require_admin)])
def delete_gallery_item(image_id: int, db: Session = Depends(get_db)):
    image = db.get(ProjectImage, image_id)
    if not image:
        raise HTTPException(status_code=404, detail="Imagen no encontrada.")
    db.delete(image)
    db.commit()


# ---- Videos ----

@router.get("/{project_identifier}/videos", response_model=list[dict])
def list_videos(project_identifier: str, db: Session = Depends(get_db)):
    project = get_project_or_404(db, project_identifier)
    videos = db.query(ProjectVideo).filter(ProjectVideo.project_id == project.id).order_by(ProjectVideo.sort_order).all()
    return [{"id": v.id, "url": v.url, "title": v.title, "description": getattr(v, "description", ""), "video_type": v.video_type} for v in videos]


@router.post("/videos", response_model=dict, dependencies=[Depends(require_admin)])
def add_video(payload: VideoCreate, db: Session = Depends(get_db)):
    get_project_or_404(db, payload.project_id)
    video = ProjectVideo(**payload.model_dump())
    db.add(video)
    db.commit()
    db.refresh(video)
    return {"id": video.id, "url": video.url, "title": video.title, "video_type": video.video_type}


@router.delete("/videos/{video_id}", status_code=204, dependencies=[Depends(require_admin)])
def delete_video(video_id: int, db: Session = Depends(get_db)):
    video = db.get(ProjectVideo, video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video no encontrado.")
    db.delete(video)
    db.commit()


# ---- Documents ----

@router.get("/{project_identifier}/documents", response_model=list[dict])
def list_documents(project_identifier: str, db: Session = Depends(get_db)):
    project = get_project_or_404(db, project_identifier)
    docs = db.query(ProjectDocument).filter(
        ProjectDocument.project_id == project.id, ProjectDocument.is_published.is_(True)
    ).order_by(ProjectDocument.category).all()
    return [{"id": d.id, "name": d.name, "category": d.category, "url": d.url, "description": d.description} for d in docs]


@router.post("/documents", response_model=dict, dependencies=[Depends(require_admin)])
def add_document(payload: DocumentCreate, db: Session = Depends(get_db)):
    get_project_or_404(db, payload.project_id)
    doc = ProjectDocument(**payload.model_dump())
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return {"id": doc.id, "name": doc.name, "category": doc.category, "url": doc.url, "description": doc.description}


@router.delete("/documents/{doc_id}", status_code=204, dependencies=[Depends(require_admin)])
def delete_document(doc_id: int, db: Session = Depends(get_db)):
    doc = db.get(ProjectDocument, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Documento no encontrado.")
    db.delete(doc)
    db.commit()


# ---- PDF Proxy (Secure) ----

@router.get("/{project_identifier}/plan-pdf")
async def get_project_plan_pdf(project_identifier: str, db: Session = Depends(get_db)):
    """
    Endpoint seguro para servir el PDF del plano sin exponer la URL de Cloudinary.
    Descarga el PDF desde Cloudinary y lo sirve como streaming response.
    """
    project = get_project_or_404(db, project_identifier)
    
    if not project.plan_pdf_url:
        raise HTTPException(
            status_code=404, 
            detail="Este proyecto no tiene un plano PDF disponible."
        )
    
    # Descargar el PDF desde Cloudinary
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.get(project.plan_pdf_url)
            response.raise_for_status()
        except httpx.HTTPError as e:
            raise HTTPException(
                status_code=503,
                detail=f"Error al obtener el PDF: {str(e)}"
            )
    
    # Servir el PDF como streaming response
    return StreamingResponse(
        iter([response.content]),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="Plano-{project.slug}.pdf"',
            "Cache-Control": "public, max-age=3600",  # Cache por 1 hora
        }
    )