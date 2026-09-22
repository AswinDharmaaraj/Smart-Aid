import enum
from sqlalchemy import Column, Integer, String, Text, Float, ForeignKey, DateTime, Enum
from sqlalchemy.sql import func
from app.db.base import Base

class SeverityEnum(str, enum.Enum):
    low = "low"
    moderate = "moderate"
    urgent = "urgent"
    critical = "critical"

class SeverityPrediction(Base):
    __tablename__ = "severity_predictions"

    prediction_id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.session_id"), nullable=False, index=True)
    emergency_type = Column(String(100), nullable=True)
    severity_level = Column(Enum(SeverityEnum), nullable=False)
    confidence_score = Column(Float, nullable=False)
    reasoning = Column(Text, nullable=False)
    predicted_at = Column(DateTime(timezone=True), server_default=func.now())