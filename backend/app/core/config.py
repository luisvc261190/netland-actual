from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuración central de la aplicación, cargada desde variables de entorno."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    APP_NAME: str = "NETLAND Corporación Inmobiliaria"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    DATABASE_URL: str = "postgresql+psycopg://postgres:postgres@localhost:5432/netland"

    JWT_SECRET: str = "change-me"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""
    CLOUDINARY_FOLDER: str = "netland"

    FRONTEND_URL: str = "http://localhost:5173"

    CORS_ORIGINS: str = (
        "http://localhost:5173, http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173,http://localhost:3000"
    )

    @property
    def cors_origins_list(self) -> list[str]:
        origins = [o.strip().rstrip("/") for o in self.CORS_ORIGINS.split(",") if o.strip()]
        frontend_url = self.FRONTEND_URL.strip().rstrip("/")
        if frontend_url and frontend_url not in origins:
            origins.append(frontend_url)
        return origins

    SEED_ADMIN_EMAIL: str = "admin@netlandcorp.com"
    SEED_ADMIN_PASSWORD: str = "AdminNetland2026"
    SEED_ADMIN_NAME: str = "Administrador Netland"

    COMPANY_WHATSAPP: str = "51985928062"
    COMPANY_PHONE: str = "985928062"
    COMPANY_NAME: str = "NETLAND Corporación Inmobiliaria"
    COMPANY_RUC: str = "20600000000"
    COMPANY_ADDRESS: str = "Av. Los Presidentes, Lambayeque - Chiclayo"

    # Plan Import Settings
    MAX_PLAN_PDF_SIZE_MB: int = 30
    PLAN_OCR_DPI: int = 300
    PLAN_OCR_LANG: str = "spa+eng"
    PLAN_CONFIDENCE_THRESHOLD: float = 0.60

    @property
    def is_cloudinary_configured(self) -> bool:
        return bool(
            self.CLOUDINARY_CLOUD_NAME
            and self.CLOUDINARY_API_KEY
            and self.CLOUDINARY_API_SECRET
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()