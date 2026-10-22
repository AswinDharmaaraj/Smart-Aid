from __future__ import annotations

from pydantic import BaseModel


class FirstAidStepSchema(BaseModel):
    title: str
    detail: str


class FirstAidGuideResponse(BaseModel):
    """Response schema for GET /api/v1/sessions/{session_id}/guidance."""

    # Identifying context
    session_id: int
    emergency_category: str
    severity_level: str          # low | moderate | urgent | critical

    # Safety flag — always True for urgent/critical
    call_emergency: bool

    # Plain-language severity context sentence
    severity_note: str

    # Structured guidance content
    steps: list[FirstAidStepSchema]
    precautions: list[str]
    avoid: list[str]

    # Mandatory disclaimer shown to all users
    disclaimer: str

    class Config:
        from_attributes = True
