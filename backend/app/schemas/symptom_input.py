from pydantic import BaseModel
from datetime import datetime

class SymptomInputCreate(BaseModel):
    raw_text: str
    category: str | None = None

class SymptomInputResponse(BaseModel):
    input_id: int
    session_id: int
    raw_text: str
    category: str | None = None
    submitted_at: datetime

    class Config:
        from_attributes = True