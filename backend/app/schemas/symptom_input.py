from pydantic import BaseModel, field_validator
from datetime import datetime


class SymptomInputCreate(BaseModel):
    raw_text: str
    category: str | None = None

    @field_validator("raw_text")
    @classmethod
    def raw_text_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Symptom description cannot be empty.")
        if len(v) > 5000:
            raise ValueError("Symptom description cannot exceed 5000 characters.")
        return v

    @field_validator("category")
    @classmethod
    def category_not_empty_string(cls, v: str | None) -> str | None:
        if v is not None and not v.strip():
            raise ValueError("Category must be a non-empty string or absent.")
        return v


class SymptomInputResponse(BaseModel):
    input_id: int
    session_id: int
    raw_text: str
    category: str | None = None
    submitted_at: datetime

    class Config:
        from_attributes = True