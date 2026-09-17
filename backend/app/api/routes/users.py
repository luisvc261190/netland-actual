from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
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


def _email_in_use(db: Session, email: str, exclude_id: int | None = None) -> User | None:
    """Busca si el correo (sin distinción de mayúsculas) pertenece a otro usuario."""
    normalized = email.strip().lower()
    query = db.query(User).filter(func.lower(User.email) == normalized, User.id != (exclude_id or -1))
    return query.first()


def _duplicate_email_detail(email: str, existing: User) -> str:
    return (
        f"El correo «{email.strip().lower()}» ya está registrado como usuario del sistema "
        f"(cuenta de acceso de {existing.name}). En el sistema, el correo sirve como "
        "credencial de inicio de sesión y debe ser único. Usa otro correo o edita directamente "
        "la cuenta existente."
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
        raise HTTPException(
            status_code=400,
            detail=(
                f"El rol «{payload.role}» no existe. Selecciona uno de los roles "
                "disponibles en el formulario."
            ),
        )
    existing_email = _email_in_use(db, payload.email)
    if existing_email:
        raise HTTPException(status_code=409, detail=_duplicate_email_detail(payload.email, existing_email))

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
            raise HTTPException(
                status_code=400,
                detail=(
                    "El perfil de asesor solo aplica a usuarios con el rol «Asesor». "
                    "Selecciona el rol Asesor para vincular un perfil."
                ),
            )
        advisor = db.get(Advisor, payload.advisor_id)
        if not advisor:
            raise HTTPException(
                status_code=404,
                detail=(
                    "No se encontró el perfil de asesor seleccionado. "
                    "Recarga la página e inténtalo de nuevo."
                ),
            )
        if advisor.user_id is not None:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Mmm, el asesor «{advisor.name}» ya tiene una cuenta de acceso asignada. "
                    "Cada perfil de asesor solo puede vincularse a un usuario. "
                    "Selecciona otro asesor o crea el usuario sin vínculo por ahora."
                ),
            )

    user = User(
        name=payload.name,
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        role_id=role.id,
        created_by=current_user.id if current_user.role.name != "SUPER_ADMIN" else None,
    )
    db.add(user)
    try:
        if advisor:
            db.flush()
            advisor.user_id = user.id
        db.commit()
    except IntegrityError:
        db.rollback()
        # La BD es la fuente de verdad final: correo duplicado en una carrera de solicitudes.
        existing = _email_in_use(db, payload.email, exclude_id=user.id)
        raise HTTPException(
            status_code=409,
            detail=(
                _duplicate_email_detail(payload.email, existing)
                if existing
                else "No se pudo crear el usuario. Verifica los datos e inténtalo nuevamente."
            ),
        )
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
    incoming_role = data.get("role")
    if "password" in data and data["password"]:
        user.password_hash = hash_password(data.pop("password"))
    elif "password" in data:
        data.pop("password")
    if "email" in data and data["email"]:
        existing = _email_in_use(db, data["email"], exclude_id=user.id)
        if existing:
            raise HTTPException(status_code=409, detail=_duplicate_email_detail(data["email"], existing))
        data["email"] = data["email"].strip().lower()
    if "role" in data:
        role = db.query(RoleModel).filter(RoleModel.name == data["role"]).first()
        if not role:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"El rol «{data['role']}» no existe. Selecciona uno de los roles "
                    "disponibles en el formulario."
                ),
            )
        user.role_id = role.id
        data.pop("role")
    if "advisor_id" in data:
        advisor_id = data.pop("advisor_id")
        effective_role = incoming_role or user.role.name
        if advisor_id is not None:
            if effective_role != "ASESOR":
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "El perfil de asesor solo aplica a usuarios con el rol «Asesor». "
                        "Selecciona el rol Asesor para vincular un perfil."
                    ),
                )
            advisor = db.get(Advisor, advisor_id)
            if not advisor:
                raise HTTPException(
                    status_code=404,
                    detail=(
                        "No se encontró el perfil de asesor seleccionado. "
                        "Recarga la página e inténtalo de nuevo."
                    ),
                )
            # Cada perfil de asesor solo puede vincularse a un usuario.
            if advisor.user_id is not None and advisor.user_id != user.id:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Mmm, el asesor «{advisor.name}» ya tiene una cuenta de acceso asignada. "
                        "Cada perfil de asesor solo puede vincularse a un usuario. "
                        "Selecciona otro asesor o deja el usuario sin vínculo por ahora."
                    ),
                )
            # Si el usuario ya tenía otro asesor vinculado, lo desvincula.
            if user.advisor and user.advisor.id != advisor.id:
                user.advisor.user_id = None
            advisor.user_id = user.id
        else:
            # Desvincular el asesor actual del usuario.
            if user.advisor:
                user.advisor.user_id = None
    for key, value in data.items():
        if value is not None:
            setattr(user, key, value)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="No se pudo guardar el usuario. Es posible que el correo ya esté en uso por otra cuenta.",
        )
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