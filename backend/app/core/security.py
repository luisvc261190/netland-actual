import threading
import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.core.config import settings


# ---------------------------------------------------------------------------
# Contraseñas (bcrypt)
# ---------------------------------------------------------------------------

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    if not plain_password or not hashed_password:
        return False
    try:
        # bcrypt solo usa los primeros 72 bytes; recortamos explícitamente para
        # evitar diferencias de comportamiento entre longitudes.
        return bcrypt.checkpw(
            plain_password.encode("utf-8")[:72],
            hashed_password.encode("utf-8"),
        )
    except (ValueError, TypeError):
        return False


# ---------------------------------------------------------------------------
# Tokens JWT (HS256)
# ---------------------------------------------------------------------------

# Lista de revocación en memoria: jti -> exp (epoch UTC). Mantiene los tokens
# invalidados hasta que expiren. Adecuada para despliegues de un solo proceso.
_REVOKED_TOKENS: dict[str, float] = {}
_REVOKED_LOCK = threading.Lock()


def create_access_token(subject: str, extra: dict | None = None) -> str:
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload: dict = {
        "sub": str(subject),
        "jti": uuid.uuid4().hex,
        "iat": now,
        "exp": expire,
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])


def revoke_token(token: str) -> None:
    """Invalida un token agregándolo a la lista de revocación hasta su expiración."""
    try:
        payload = decode_access_token(token)
    except jwt.InvalidTokenError:
        return
    exp = payload.get("exp")
    if not exp:
        return
    with _REVOKED_LOCK:
        _purge_revoked_tokens()
        _REVOKED_TOKENS[payload.get("jti")] = exp


def is_token_revoked(token: str) -> bool:
    """Indica si un token ya fue inválidado."""
    try:
        payload = decode_access_token(token)
    except jwt.InvalidTokenError:
        return True
    with _REVOKED_LOCK:
        _purge_revoked_tokens()
        return payload.get("jti") in _REVOKED_TOKENS


def _purge_revoked_tokens() -> None:
    """Elimina de la lista los tokens ya vencidos para evitar crecimiento ilimitado."""
    now = datetime.now(timezone.utc).timestamp()
    expired = [jti for jti, exp in _REVOKED_TOKENS.items() if exp < now]
    for jti in expired:
        _REVOKED_TOKENS.pop(jti, None)
