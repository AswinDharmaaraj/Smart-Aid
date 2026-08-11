from pydantic import BaseModel
from datetime import datetime

class HistoryEntry(BaseModel):
    session_id: int
    started_at: datetime
    category: str | None = None
    raw_text: str | None = None
    severity_level: str | None = None
    confidence_score: float | None = None