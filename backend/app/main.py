import logging.config
from contextlib import asynccontextmanager

from starlette.middleware.base import BaseHTTPMiddleware
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError, OperationalError

from app.api.router import api_router
from app.api.routes import uploads as uploads_routes
from app.core.config import settings
from app.core.database import ensure_column_migrations
from app.core.logging import LOGGING_CONFIG

logging.config.dictConfig(LOGGING_CONFIG)
logger = logging.getLogger("netland")


# Etiquetas en español para los campos del formulario/body.
_FIELD_LABELS = {
    "email": "correo electrónico",
    "password": "contraseña",
    "name": "nombre",
    "role": "rol",
    "advisor_id": "perfil de asesor",
    "user_quota": "cuota de usuarios",
    "username": "usuario",
    "document_type": "tipo de documento",
    "document_number": "número de documento",
}


def _field_label(loc) -> str:
    parts = [str(part) for part in loc if part not in ("body", "query", "path")]
    if not parts:
        return "formulario"
    return _FIELD_LABELS.get(parts[-1], parts[-1].replace("_", " "))


def _validation_error_message(err) -> str:
    etype = err.get("type", "")
    field = _field_label(err.get("loc", []))
    ctx = err.get("ctx") or {}
    msg = err.get("msg", "")

    if etype == "missing":
        return f"«{field}» es un campo obligatorio."
    if etype == "string_too_short":
        min_len = ctx.get("min_length")
        return (
            f"«{field}» debe tener al menos {min_len} caracteres."
            if min_len is not None
            else f"«{field}» es demasiado corto."
        )
    if etype in ("string_pattern_mismatch",):
        return f"«{field}» no cumple el formato esperado. Revisa los caracteres ingresados."
    if etype in ("value_error.email", "string_type") and "email" in str(err.get("loc", [])):
        return f"«{field}» no es un correo electrónico válido. Verifica que no tenga espacios ni caracteres extraños."
    if etype in ("enum", "literal_error", "unexpected_value", "value_error"):
        return f"«{field}» no corresponde a una opción válida. Revisa el valor ingresado."
    if etype.startswith("int_") or etype in ("greater_than_equal", "less_than_equal", "finite_number"):
        return f"«{field}» debe ser un número válido."
    # Mensaje genérico legible (se quita el sufijo técnico de pydantic).
    clean = msg.split("(type=")[0].strip().strip(".")
    clean = clean[0].lower() + clean[1:] if clean else "es inválido."
    return f"«{field}»: {clean}."


@asynccontextmanager
async def lifespan(_: FastAPI):
    try:
        ensure_column_migrations()
    except Exception:
        logger.exception("No se pudieron aplicar migraciones de esquema")
    yield


app = FastAPI(
    title=f"{settings.APP_NAME} API",
    version="1.0.0",
    docs_url="/docs" if settings.ENABLE_DOCS else None,
    openapi_url="/openapi.json" if settings.ENABLE_DOCS else None,
    redoc_url=None,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Agrega cabeceras de seguridad básicas a todas las respuestas."""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "SAMEORIGIN")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault("X-XSS-Protection", "1; mode=block")
        return response


app.add_middleware(SecurityHeadersMiddleware)


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    if not errors:
        return JSONResponse(
            status_code=422,
            content={"detail": "Revisa los datos enviados e inténtalo nuevamente."},
        )
    friendly = [_validation_error_message(err) for err in errors]
    if len(friendly) == 1:
        detail = friendly[0]
    else:
        detail = "No se pudo guardar. Corrige los siguientes campos:\n" + "\n".join(
            f"· {m}" for m in friendly
        )
    return JSONResponse(status_code=422, content={"detail": detail})


@app.exception_handler(IntegrityError)
async def integrity_error_handler(request: Request, exc: IntegrityError):
    logger.error("IntegrityError: %s", exc)
    return JSONResponse(
        status_code=409,
        content={"detail": "No se pudo completar la operación: dato duplicado o relación inválida."},
    )


@app.exception_handler(OperationalError)
async def operational_error_handler(request: Request, exc: OperationalError):
    logger.error("OperationalError: %s", exc)
    return JSONResponse(
        status_code=503,
        content={"detail": "Error de conexión con la base de datos. Intente nuevamente."},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Error no controlado en %s", request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Ocurrió un error interno. Intente nuevamente."},
    )


app.include_router(api_router)
# Alias for clients that post to /uploads instead of /api/uploads
app.include_router(uploads_routes.router)


@app.get("/health")
def health():
    return {"status": "ok", "app": settings.APP_NAME}


@app.get("/api/health")
def api_health():
    return {"status": "ok", "app": settings.APP_NAME}