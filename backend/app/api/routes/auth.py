from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.rate_limit import login_rate_limiter
from app.core.security import create_access_token, revoke_token, verify_password
from app.domain.models import User
from app.schemas.auth import LoginRequest, Token, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


def _client_ip(request: Request) -> str:
    """Devuelve la IP del cliente teniendo en cuenta proxies confiables."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


def _build_token(user: User) -> Token:
    token = create_access_token(str(user.id), extra={"role": user.role.name if user.role else ""})
    return Token(access_token=token, user=UserOut.from_user(user))


def _authenticate(db: Session, identifier: str, password: str) -> User:
    """Valida credenciales de forma uniforme sin filtrar información sensible."""
    user = db.query(User).filter(User.email == identifier.lower().strip()).first()
    if not user or not verify_password(password, user.password_hash or "") or not user.is_active:
        # Respuesta uniforme: no se revela si el correo existe, la contraseña es
        # incorrecta o la cuenta está desactivada.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Correo o contraseña incorrectos.",
        )
    return user


@router.post("/login", response_model=Token)
def login(
    request: Request,
    form: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    if not login_rate_limiter.is_allowed(_client_ip(request)):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Demasiados intentos. Espera unos minutos antes de volver a intentarlo.",
        )
    user = _authenticate(db, form.username, form.password)
    login_rate_limiter.reset(_client_ip(request))
    return _build_token(user)


@router.post("/login/json", response_model=Token)
def login_json(
    request: Request,
    payload: LoginRequest,
    db: Session = Depends(get_db),
):
    if not login_rate_limiter.is_allowed(_client_ip(request)):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Demasiados intentos. Espera unos minutos antes de volver a intentarlo.",
        )
    user = _authenticate(db, payload.email, payload.password)
    login_rate_limiter.reset(_client_ip(request))
    return _build_token(user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    request: Request,
    current_user: User = Depends(get_current_user),
):
    """Invalida el token actual para que no pueda volver a usarse."""
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        revoke_token(auth.split(" ", 1)[1].strip())
