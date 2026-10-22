from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from app.models.feedback import FeedbackCategoryEnum

class FeedbackCreate(BaseModel):
    session_id: Optional[int] = Field(None, description="Optional associated emergency session ID")
    rating: int = Field(..., ge=1, le=5, description="First-aid experience rating from 1 to 5")
    category: FeedbackCategoryEnum = Field(default=FeedbackCategoryEnum.general, description="Feedback category")
    comments: Optional[str] = Field(None, max_length=2000, description="User comments or observations")
    contact_email: Optional[EmailStr] = Field(None, description="Optional contact email for follow-up")

    model_config = ConfigDict(extra="forbid")

class FeedbackAdminUpdate(BaseModel):
    is_reviewed: Optional[bool] = Field(None, description="Administrative review status flag")
    admin_notes: Optional[str] = Field(None, max_length=2000, description="Internal administrator resolution notes")

    model_config = ConfigDict(extra="forbid")

class FeedbackResponse(BaseModel):
    feedback_id: int
    session_id: Optional[int] = None
    user_id: Optional[int] = None
    rating: int
    category: FeedbackCategoryEnum
    comments: Optional[str] = None
    contact_email: Optional[str] = None
    is_reviewed: bool
    admin_notes: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
