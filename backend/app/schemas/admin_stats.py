from typing import Dict
from pydantic import BaseModel, Field

class AdminStatsResponse(BaseModel):
    total_users: int = Field(0, description="Total registered users")
    total_qr_codes: int = Field(0, description="Total QR codes in the system")
    active_qr_codes: int = Field(0, description="Active QR codes ready for scanning")
    inactive_qr_codes: int = Field(0, description="Inactive or deactivated QR codes")
    total_sessions: int = Field(0, description="Total emergency triage sessions initiated")
    sessions_by_severity: Dict[str, int] = Field(default_factory=dict, description="Session counts categorized by severity level")
    sessions_by_category: Dict[str, int] = Field(default_factory=dict, description="Session counts categorized by emergency type")
    total_feedback: int = Field(0, description="Total feedback submissions received")
    average_rating: float = Field(0.0, description="Average feedback rating (1.0 - 5.0) or 0.0 if no feedback")
    feedback_by_category: Dict[str, int] = Field(default_factory=dict, description="Feedback submissions broken down by category")
    reviewed_feedback: int = Field(0, description="Feedback items marked as reviewed by an administrator")
    unreviewed_feedback: int = Field(0, description="Pending unreviewed feedback submissions")
