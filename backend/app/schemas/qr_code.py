from pydantic import BaseModel
from datetime import datetime
from app.models.qr_code import QRStatusEnum

class QRCodeCreate(BaseModel):
    location_name: str
    install_site: str | None = None

class QRCodeResponse(BaseModel):
    qr_code_id: int
    location_name: str
    install_site: str | None = None
    installed_at: datetime
    status: QRStatusEnum

    class Config:
        from_attributes = True

class SessionResponse(BaseModel):
    session_id: int
    qr_code_id: int
    user_id: int | None = None
    network_mode: str
    started_at: datetime

    class Config:
        from_attributes = True