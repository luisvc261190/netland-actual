from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)


class UserBase(BaseModel):
    name: str
    email: EmailStr
    role: str


class UserCreate(BaseModel):
    name: str = Field(min_length=2)
    email: EmailStr
    password: str = Field(min_length=8)
    role: str = Field(default="ASESOR")
    advisor_id: int | None = None


class UserUpdate(BaseModel):
    name: str | None = None
    email: EmailStr | None = None
    password: str | None = Field(default=None, min_length=8)
    role: str | None = None
    is_active: bool | None = None
    # Cuota de usuarios que un ADMIN puede crear (solo puede asignarla SUPER_ADMIN).
    user_quota: int | None = Field(default=None, ge=0, le=10000)


class UserOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: str
    is_active: bool
    advisor_id: int | None = None
    advisor_name: str | None = None
    user_quota: int | None = None
    created_by: int | None = None
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)

    @classmethod
    def from_user(cls, user) -> "UserOut":
        return cls(
            id=user.id,
            name=user.name,
            email=user.email,
            role=user.role.name if user.role else "",
            is_active=user.is_active,
            advisor_id=user.advisor.id if user.advisor else None,
            advisor_name=user.advisor.name if user.advisor else None,
            user_quota=user.user_quota,
            created_by=user.created_by,
            created_at=user.created_at,
        )