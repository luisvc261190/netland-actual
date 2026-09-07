"""
API Routes para Propietarios
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.domain.models import User
from app.domain.owners_models import Owner
from app.infrastructure.owners_service import OwnersService
from app.schemas.owners import (
    OwnerCreate,
    OwnerUpdate,
    OwnerResponse,
    OwnerWithClient,
    OwnerDetail,
)

router = APIRouter(prefix="/owners", tags=["owners"])


@router.post("/", response_model=OwnerResponse, status_code=status.HTTP_201_CREATED)
def create_owner(
    owner_data: OwnerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Crear nuevo propietario"""
    # Verificar si ya existe por documento
    existing = OwnersService.get_owner_by_document(
        db, owner_data.document_type, owner_data.document_number
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ya existe un propietario con {owner_data.document_type} {owner_data.document_number}"
        )
    
    owner = OwnersService.create_owner(
        db, owner_data.dict(), user_id=current_user.id
    )
    return owner


@router.get("/", response_model=List[OwnerWithClient])
def list_owners(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    search: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Listar propietarios"""
    query = db.query(Owner)
    
    if is_active is not None:
        query = query.filter(Owner.is_active == is_active)
    
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (Owner.document_number.ilike(search_term)) |
            (Owner.first_name.ilike(search_term)) |
            (Owner.paternal_surname.ilike(search_term)) |
            (Owner.business_name.ilike(search_term))
        )
    
    owners = query.offset(skip).limit(limit).all()
    
    # Enriquecer con datos del cliente y totales
    result = []
    for owner in owners:
        summary = OwnersService.get_owner_with_summary(db, owner.id)
        if summary:
            result.append({
                **owner.__dict__,
                "client_name": summary["client"].name,
                "client_phone": summary["client"].phone,
                "client_email": summary["client"].email,
                "total_properties": summary["total_properties"],
                "total_debt": float(summary["outstanding_balance"]),
                "overdue_debt": float(summary["overdue_debt"])
            })
    
    return result


@router.get("/{owner_id}", response_model=OwnerDetail)
def get_owner(
    owner_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Obtener detalle de propietario"""
    summary = OwnersService.get_owner_with_summary(db, owner_id)
    if not summary:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Propietario no encontrado"
        )
    
    owner = summary["owner"]
    client = summary["client"]
    
    # Preparar propiedades
    properties = []
    for contract in summary["contracts"]:
        prop = {
            "contract_id": contract.id,
            "contract_number": contract.contract_number,
            "project_name": contract.project.short_name,
            "block_code": contract.lot.block.code if contract.lot.block else None,
            "lot_code": contract.lot.code,
            "lot_area_m2": float(contract.lot_area_m2),
            "total_price": float(contract.total_price),
            "payment_modality": contract.payment_modality,
            "status": contract.status
        }
        properties.append(prop)
    
    return {
        **owner.__dict__,
        "client_name": client.name,
        "client_phone": client.phone,
        "client_email": client.email,
        "total_properties": summary["total_properties"],
        "total_purchased": float(summary["total_purchased"]),
        "total_paid": float(summary["total_paid"]),
        "outstanding_balance": float(summary["outstanding_balance"]),
        "overdue_debt": float(summary["overdue_debt"]),
        "total_debt": float(summary["outstanding_balance"]),
        "contracts_count": len(summary["contracts"]),
        "properties": properties
    }


@router.put("/{owner_id}", response_model=OwnerResponse)
def update_owner(
    owner_id: int,
    owner_data: OwnerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Actualizar propietario"""
    owner = db.query(Owner).filter(Owner.id == owner_id).first()
    if not owner:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Propietario no encontrado"
        )
    
    # Actualizar solo campos proporcionados
    update_data = owner_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(owner, field, value)
    
    owner.updated_by = current_user.id
    
    db.commit()
    db.refresh(owner)
    return owner


@router.delete("/{owner_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_owner(
    owner_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Eliminar propietario (solo si no tiene contratos activos)"""
    owner = db.query(Owner).filter(Owner.id == owner_id).first()
    if not owner:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Propietario no encontrado"
        )
    
    # Verificar contratos activos
    from app.domain.owners_models import Contract
    active_contracts = db.query(Contract).filter(
        Contract.owner_id == owner_id,
        Contract.status == "activo"
    ).count()
    
    if active_contracts > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No se puede eliminar. El propietario tiene {active_contracts} contratos activos"
        )
    
    db.delete(owner)
    db.commit()
    return None


@router.get("/document/{document_type}/{document_number}", response_model=OwnerResponse)
def get_owner_by_document(
    document_type: str,
    document_number: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Buscar propietario por documento"""
    owner = OwnersService.get_owner_by_document(db, document_type, document_number)
    if not owner:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Propietario no encontrado"
        )
    return owner
