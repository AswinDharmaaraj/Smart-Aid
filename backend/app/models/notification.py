import enum
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum
from sqlalchemy.sql import func
from app.db.base import Base

class NotificationTypeEnum(str, enum.Enum):
    emergency_alert = "emergency_alert"
    hospital_dispatch = "hospital_dispatch"
    report_share = "report_share"
    general = "general"

class NotificationStatusEnum(str, enum.Enum):
    simulated = "simulated"
    queued = "queued"
    sent = "sent"
    failed = "failed"

class NotificationLog(Base):
    __tablename__ = "notification_logs"

    notification_id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.session_id"), nullable=True, index=True)
    recipient_phone = Column(String(20), nullable=False)
    message_type = Column(Enum(NotificationTypeEnum), nullable=False, default=NotificationTypeEnum.emergency_alert)
    message_body = Column(Text, nullable=False)
    status = Column(Enum(NotificationStatusEnum), nullable=False, default=NotificationStatusEnum.simulated, index=True)
    provider = Column(String(50), nullable=False, default="mock")
    idempotency_key = Column(String(64), unique=True, nullable=False, index=True)
    error_details = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)

    @property
    def recipient_phone_masked(self) -> str:
        """Returns phone number with middle digits masked for privacy-safe UI display."""
        if not self.recipient_phone:
            return ""
        phone = self.recipient_phone.strip()
        if len(phone) <= 5:
            return "****"
        # Keep first 3 characters (+country code or start) and last 2 characters
        masked_length = len(phone) - 5
        return phone[:3] + ("*" * masked_length) + phone[-2:]
