from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict
from app.models.notification import NotificationTypeEnum, NotificationStatusEnum

class NotificationLogCreate(BaseModel):
    session_id: Optional[int] = Field(None, description="Optional associated emergency session ID")
    recipient_phone: str = Field(..., min_length=7, max_length=20, description="Recipient phone number (E.164 format)")
    message_type: NotificationTypeEnum = Field(default=NotificationTypeEnum.emergency_alert, description="Notification message type")
    message_body: str = Field(..., min_length=1, max_length=1000, description="Situational notification text")
    provider: str = Field(default="mock", max_length=50, description="Notification service provider identifier")
    idempotency_key: str = Field(..., min_length=16, max_length=64, description="Unique client key preventing duplicate dispatches")

class NotificationLogResponse(BaseModel):
    notification_id: int
    session_id: Optional[int] = None
    recipient_phone_masked: str
    message_type: NotificationTypeEnum
    message_body: str
    status: NotificationStatusEnum
    provider: str
    idempotency_key: str
    error_details: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
