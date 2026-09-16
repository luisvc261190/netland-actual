from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import require_roles, get_current_user
from app.core.security import hash_password
from app.domain.models import Advisor, RoleModel, User
from app.schemas.auth import UserCreate, UserOut, UserUpdate
from app.schemas.crm import AdvisorOut

router = APIRouter(prefix="/users", tags=["users"])

# Roles que solo puede gestionar SUPER_ADMIN.
PRIVILEGED_ROLES = {"SUPER_ADMIN", "ADMIN"}

# Dependency: usuarios con acceso a la gestión de cuentas del sistema.
user_roles = require_roles("SUPER_ADMIN", "ADMIN")


def _not_found() -> HTTPException:
    return HTTPException(status_code=404, detail="Usuario no encontrado.")


def _forbidden() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="No tienes permisos para realizar esta acción.",
    )


def _count_created(db: Session, admin_id: int) -> int:
    """Número de usuarios creados por un administrador."""
    return db.query(func.count(User.id)).filter(User.created_by == admin_id).scalar() or 0


def _users_query(db: Session, viewer: User):
    """Consulta de usuarios visibles según el rol del viewer.

    - SUPER_ADMIN: ve todos los usuarios del sistema.
    - ADMIN: solo ve su propia cuenta y los usuarios que él creó.
    """
    query = db.query(User)
    if viewer.role.name == "ADMIN":
        query = query.filter(or_(User.created_by == viewer.id, User.id == viewer.id))
    return query.order_by(User.id.asc())


def _can_manage(actor: User, target: User) -> bool:
    """Un ADMIN solo gestiona usuarios que él mismo creó y sin rol privilegiado."""
    return target.role.name not in PRIVILEGED_ROLES and target.created_by == actor.id


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return UserOut.from_user(user)


@router.get("", response_model=list[UserOut])
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(user_roles),
):
    return [UserOut.from_user(u) for u in _users_query(db, current_user).all()]


@router.get("/available-advisors", response_model=list[AdvisorOut], dependencies=[Depends(user_roles)])
def list_available_advisors(db: Session = Depends(get_db)):
    """Asesores que todavía no tienen una cuenta de acceso vinculada."""
    return db.query(Advisor).filter(Advisor.user_id.is_(None)).order_by(Advisor.name.asc()).all()


@router.post("", response_model=UserOut, status_code=201)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(user_roles),
):
    role = db.query(RoleModel).filter(RoleModel.name == payload.role).first()
    if not role:
        raise HTTPException(status_code=400, detail="Rol inválido.")
    if db.query(User).filter(User.email == payload.email.lower()).first():
        raise HTTPException(status_code=400, detail="El correo ya está registrado.")

    # Un ADMIN no puede crear roles privilegiados ni exceder su cuota asignada.
    if current_user.role.name == "ADMIN":
        if payload.role in PRIVILEGED_ROLES:
            raise _forbidden()
        quota = current_user.user_quota or 0
        created = _count_created(db, current_user.id)
        if created >= quota:
            detail = (
                f"No puedes crear más usuarios. Tu cuota asignada es {quota} "
                f"y ya usaste {created}. Solicita al super administrador aumentarla."
            )
            if quota == 0:
                detail = (
                    "El super administrador aún no te asigna cuota para crear usuarios. "
                    "Solicítale que la configure."
                )
            raise HTTPException(status_code=400, detail=detail)

    advisor = None
    if payload.advisor_id is not None:
        if payload.role != "ASESOR":
            raise HTTPException(status_code=400, detail="Solo los usuarios asesores pueden vincularse a un asesor.")
        advisor = db.get(Advisor, payload.advisor_id)
        if not advisor:
            raise HTTPException(status_code=404, detail="Asesor no encontrado.")
        if advisor.user_id is not None:
            raise HTTPException(status_code=400, detail="Este asesor ya tiene un usuario asignado.")

    user = User(
        name=payload.name,
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        role_id=role.id,
        created_by=current_user.id if current_user.role.name != "SUPER_ADMIN" else None,
    )
    db.add(user)
    if advisor:
        db.flush()
        advisor.user_id = user.id
    db.commit()
    db.refresh(user)
    return UserOut.from_user(user)


@router.put("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(user_roles),
):
    user = db.get(User, user_id)
    if not user:
        raise _not_found()

    if current_user.role.name == "ADMIN":
        if not _can_manage(current_user, user):
            raise _forbidden()
        if payload.role and payload.role in PRIVILEGED_ROLES:
            raise _forbidden()
        if payload.user_quota is not None:
            raise _forbidden()

    data = payload.model_dump(exclude_unset=True)
    if "password" in data and data["password"]:
        user.password_hash = hash_password(data.pop("password"))
    if "role" in data:
        role = db.query(RoleModel).filter(RoleModel.name == data["role"]).first()
        if not role:
            raise HTTPException(status_code=400, detail="Rol inválido.")
        user.role_id = role.id
        data.pop("role")
    for key, value in data.items():
        if value is not None:
            setattr(user, key, value)
    db.commit()
    db.refresh(user)
    return UserOut.from_user(user)


@router.delete("/{user_id}", status_code=204)
def delete_user(
    user_id: int,
    current_user: User = Depends(user_roles),
    db: Session = Depends(get_db),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="No puedes eliminar tu propio usuario.")
    user = db.get(User, user_id)
    if not user:
        raise _not_found()
    if current_user.role.name == "ADMIN" and not _can_manage(current_user, user):
        raise _forbidden()
    db.delete(user)
    db.commit()