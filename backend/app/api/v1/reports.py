from __future__ import annotations

import logging
import re
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session as DBSession

from app.api.v1.deps import get_current_user_optional
from app.db.session import get_db
from app.models.qr_code import QRCode
from app.models.session import Session as SessionModel
from app.models.severity_prediction import SeverityPrediction
from app.models.symptom_input import SymptomInput
from app.models.user import User, RoleEnum
from app.schemas.report import (
    IncidentReportResponse,
    ReportFirstAidStep,
    ReportGuidanceInfo,
    ReportPredictionInfo,
    ReportQRInfo,
    ReportSymptomInfo,
)
from app.services.first_aid_service import get_guidance

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/sessions", tags=["reports"])


def _parse_age_and_conditions(raw_text: Optional[str]) -> tuple[Optional[float], Optional[list[str]]]:
    """Extract age and existing conditions from composed symptom text if available."""
    if not raw_text:
        return None, None

    age: Optional[float] = None
    conditions: list[str] = []

    age_match = re.search(r"age:\s*(\d+(?:\.\d+)?)", raw_text, re.IGNORECASE)
    if age_match:
        try:
            age = float(age_match.group(1))
        except ValueError:
            pass

    cond_match = re.search(r"conditions?:\s*([^\n.]+)", raw_text, re.IGNORECASE)
    if cond_match:
        conditions = [c.strip() for c in cond_match.group(1).split(",") if c.strip()]

    return age, conditions or None


@router.get(
    "/{session_id}/report",
    response_model=IncidentReportResponse,
    summary="Retrieve structured incident report for an emergency session",
    description=(
        "Returns the complete incident summary for the specified session, including "
        "QR location, reported symptoms, triage severity prediction, and recommended first aid. "
        "Guest walk-in QR sessions are accessible via session ID. Authenticated user sessions "
        "are protected and restricted to the session owner or admin."
    ),
)
def get_incident_report(
    session_id: int,
    db: DBSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
) -> IncidentReportResponse:
    # 1. Look up session
    session = db.query(SessionModel).filter(SessionModel.session_id == session_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {session_id} not found.",
        )

    # 2. Access control / privacy protection:
    # If the session is bound to an account (user_id is not None), verify ownership.
    if session.user_id is not None:
        if current_user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required to access this emergency report.",
            )
        if current_user.user_id != session.user_id and current_user.role != RoleEnum.admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to view this emergency report.",
            )

    # 3. Retrieve associated QR code metadata
    qr_info: Optional[ReportQRInfo] = None
    if session.qr_code_id:
        qr = db.query(QRCode).filter(QRCode.qr_code_id == session.qr_code_id).first()
        if qr:
            qr_info = ReportQRInfo(
                qr_code_id=qr.qr_code_id,
                location_name=qr.location_name,
                install_site=qr.install_site,
            )

    # 4. Retrieve latest symptom input if present
    symptom_info: Optional[ReportSymptomInfo] = None
    symptom = (
        db.query(SymptomInput)
        .filter(SymptomInput.session_id == session_id)
        .order_by(SymptomInput.submitted_at.desc())
        .first()
    )
    if symptom:
        symptom_info = ReportSymptomInfo(
            input_id=symptom.input_id,
            raw_text=symptom.raw_text,
            category=symptom.category,
            submitted_at=symptom.submitted_at,
        )

    # 5. Retrieve latest severity prediction if present
    prediction_info: Optional[ReportPredictionInfo] = None
    guidance_info: Optional[ReportGuidanceInfo] = None

    prediction = (
        db.query(SeverityPrediction)
        .filter(SeverityPrediction.session_id == session_id)
        .order_by(SeverityPrediction.predicted_at.desc())
        .first()
    )

    if prediction:
        severity_str = (
            prediction.severity_level.value
            if hasattr(prediction.severity_level, "value")
            else str(prediction.severity_level)
        )
        prediction_info = ReportPredictionInfo(
            prediction_id=prediction.prediction_id,
            emergency_type=prediction.emergency_type,
            severity_level=severity_str,
            confidence_score=prediction.confidence_score,
            reasoning=prediction.reasoning,
            vitals_estimated=getattr(prediction, "vitals_estimated", True),
            predicted_at=prediction.predicted_at,
        )

        # 6. Generate corresponding first aid guidance for the report
        raw_text = symptom.raw_text if symptom else None
        age, conditions = _parse_age_and_conditions(raw_text)
        category = prediction.emergency_type or (symptom.category if symptom else "General")

        try:
            guide = get_guidance(
                emergency_category=category,
                severity_level=severity_str,
                age=age,
                conditions=conditions,
            )
            guidance_info = ReportGuidanceInfo(
                emergency_category=guide.emergency_category,
                severity_level=guide.severity_level,
                call_emergency=guide.call_emergency,
                severity_note=guide.severity_note,
                steps=[ReportFirstAidStep(title=s.title, detail=s.detail) for s in guide.steps],
                precautions=guide.precautions,
                avoid=guide.avoid,
            )
        except Exception as exc:
            logger.warning("Could not assemble first-aid guidance for report: %s", exc)
            guidance_info = None

    # 7. Format clean, traceable report ID
    started = session.started_at
    date_part = started.strftime("%Y%m%d") if started else "PENDING"
    formatted_report_id = f"SA-{date_part}-{session.session_id:05d}"

    network_mode_str = (
        session.network_mode.value
        if hasattr(session.network_mode, "value")
        else str(session.network_mode or "online")
    )

    return IncidentReportResponse(
        report_id=formatted_report_id,
        session_id=session.session_id,
        started_at=session.started_at,
        network_mode=network_mode_str,
        qr_info=qr_info,
        symptoms=symptom_info,
        prediction=prediction_info,
        guidance=guidance_info,
    )
