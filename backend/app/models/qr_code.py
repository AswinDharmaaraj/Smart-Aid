import enum
from sqlalchemy import Column, Integer, String, DateTime, Enum
from sqlalchemy.sql import func
from app.db.base import Base

class QRStatusEnum(str, enum.Enum):
    active = "active"
    inactive = "inactive"

class QRCode(Base):
    __tablename__ = "qr_codes"

    qr_code_id = Column(Integer, primary_key=True, index=True)
    location_name = Column(String(150), nullable=False)
    install_site = Column(String(255), nullable=True)
    installed_at = Column(DateTime(timezone=True), server_default=func.now())
    status = Column(Enum(QRStatusEnum), default=QRStatusEnum.active, nullable=False)