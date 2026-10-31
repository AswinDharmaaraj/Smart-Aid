from __future__ import annotations

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class ReportQRInfo(BaseModel):
    qr_code_id: int
    location_name: str
    install_site: Optional[str] = None

    class Config:
        from_attributes = True


class ReportSymptomInfo(BaseModel):
    input_id: int
    raw_text: str
    category: Optional[str] = None
    submitted_at: datetime

    class Config:
        from_attributes = True


class ReportPredictionInfo(BaseModel):
    prediction_id: int
    emergency_type: Optional[str] = None
    severity_level: str
    confidence_score: float
    reasoning: str
    vitals_estimated: bool = True
    predicted_at: datetime

    class Config:
        from_attributes = True


class ReportFirstAidStep(BaseModel):
    title: str
    detail: str


class ReportGuidanceInfo(BaseModel):
    emergency_category: str
    severity_level: str
    call_emergency: bool
    severity_note: str
    steps: list[ReportFirstAidStep] = Field(default_factory=list)
    precautions: list[str] = Field(default_factory=list)
    avoid: list[str] = Field(default_factory=list)


class IncidentReportResponse(BaseModel):
    """Complete structured incident report for an emergency session."""
    report_id: str
    session_id: int
    started_at: datetime
    network_mode: str
    qr_info: Optional[ReportQRInfo] = None
    symptoms: Optional[ReportSymptomInfo] = None
    prediction: Optional[ReportPredictionInfo] = None
    guidance: Optional[ReportGuidanceInfo] = None
    disclaimer: str = (
        "First-aid decision-support report only. Not a clinical diagnosis. "
        "Intended for emergency responder handover and clinical assessment."
    )

    class Config:
        from_attributes = True
