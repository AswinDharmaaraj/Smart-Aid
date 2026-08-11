from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime
from sqlalchemy.sql import func
from app.db.base import Base

class SymptomInput(Base):
    __tablename__ = "symptom_inputs"

    input_id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.session_id"), nullable=False)
    raw_text = Column(Text, nullable=False)
    category = Column(String(100), nullable=True)
    submitted_at = Column(DateTime(timezone=True), server_default=func.now())