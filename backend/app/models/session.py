import enum
from sqlalchemy import Column, Integer, ForeignKey, DateTime, Enum
from sqlalchemy.sql import func
from app.db.base import Base

class NetworkModeEnum(str, enum.Enum):
    online = "online"
    offline = "offline"

class Session(Base):
    __tablename__ = "sessions"

    session_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    qr_code_id = Column(Integer, ForeignKey("qr_codes.qr_code_id"), nullable=False)
    network_mode = Column(Enum(NetworkModeEnum), default=NetworkModeEnum.online)
    started_at = Column(DateTime(timezone=True), server_default=func.now())