import enum
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Enum, CheckConstraint
from sqlalchemy.sql import func
from app.db.base import Base

class FeedbackCategoryEnum(str, enum.Enum):
    guidance_clarity = "guidance_clarity"
    hospital_locator = "hospital_locator"
    triage_accuracy = "triage_accuracy"
    system_usability = "system_usability"
    general = "general"

class Feedback(Base):
    __tablename__ = "feedbacks"

    feedback_id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.session_id"), nullable=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=True, index=True)
    rating = Column(Integer, nullable=False)
    category = Column(Enum(FeedbackCategoryEnum), nullable=False, default=FeedbackCategoryEnum.general, index=True)
    comments = Column(Text, nullable=True)
    contact_email = Column(String(100), nullable=True)
    is_reviewed = Column(Boolean, default=False, nullable=False, index=True)
    admin_notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)

    __table_args__ = (
        CheckConstraint("rating >= 1 AND rating <= 5", name="ck_feedback_rating_range"),
    )
