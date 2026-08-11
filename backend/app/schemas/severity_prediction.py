from pydantic import BaseModel
from datetime import datetime

class SeverityPredictionResponse(BaseModel):
    prediction_id: int
    session_id: int
    emergency_type: str | None = None
    severity_level: str
    confidence_score: float
    reasoning: str
    predicted_at: datetime

    class Config:
        from_attributes = True