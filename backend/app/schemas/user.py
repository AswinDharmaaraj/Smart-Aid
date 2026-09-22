from pydantic import BaseModel, EmailStr
from datetime import datetime
from app.models.user import RoleEnum

class UserCreate(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    phone: str | None = None

class UserResponse(BaseModel):
    user_id: int
    full_name: str
    email: EmailStr
    role: RoleEnum
    phone: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True

class UserPublicResponse(BaseModel):
    user_id: int
    full_name: str
    role: RoleEnum
    created_at: datetime

    class Config:
        from_attributes = True