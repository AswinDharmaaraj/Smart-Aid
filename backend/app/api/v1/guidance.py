"""
SmartAid AI — First Aid Guidance Endpoint

GET /api/v1/sessions/{session_id}/guidance

Returns personalised, structured first-aid guidance for an existing session
that already has a severity prediction.  No new predictions are created here.

Error responses:
  404 — session not found
  400 — session has no completed severity prediction yet
  500 — unexpected server error (logged, not exposed to client)
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session as DBSession

from app.db.session import get_db
from app.models.session import Session as SessionModel
from app.models.symptom_input import SymptomInput
from app.models.severity_prediction import SeverityPrediction
from app.schemas.first_aid import FirstAidGuideResponse, FirstAidStepSchema
from app.services.first_aid_service import get_guidance

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/sessions", tags=["guidance"])


@router.get(
    "/{session_id}/guidance",
    response_model=FirstAidGuideResponse,
    summary="Retrieve personalised first-aid guidance for a session",
)
def get_session_guidance(
    session_id: int,
    db: DBSession = Depends(get_db),
) -> FirstAidGuideResponse:
    """
    Return structured first-aid guidance based on the existing severity prediction
    for this session.  The caller must have already called POST /{session_id}/predict.
    """
    # 1. Validate session exists
    session = db.query(SessionModel).filter(
        SessionModel.session_id == session_id
    ).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {session_id} not found.",
        )

    # 2. Fetch the most recent severity prediction for this session
    prediction = (
        db.query(SeverityPrediction)
        .filter(SeverityPrediction.session_id == session_id)
        .order_by(SeverityPrediction.predicted_at.desc())
        .first()
    )
    if not prediction:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "No severity prediction found for this session. "
                "Call POST /sessions/{session_id}/predict first."
            ),
        )

    # 3. Fetch latest symptom input for optional personalisation fields
    symptom = (
        db.query(SymptomInput)
        .filter(SymptomInput.session_id == session_id)
        .order_by(SymptomInput.submitted_at.desc())
        .first()
    )

    # 4. Extract age and conditions from raw_text if symptom exists
    #    These were encoded into raw_text by the frontend in Sprint 3.
    age: float | None = None
    conditions: list[str] = []

    if symptom and symptom.raw_text:
        import re
        age_match = re.search(r"age:\s*(\d+(?:\.\d+)?)", symptom.raw_text, re.IGNORECASE)
        if age_match:
            try:
                age = float(age_match.group(1))
            except ValueError:
                pass

        cond_match = re.search(r"conditions?:\s*([^\n.]+)", symptom.raw_text, re.IGNORECASE)
        if cond_match:
            conditions = [c.strip() for c in cond_match.group(1).split(",") if c.strip()]

    # 5. Call the guidance service — always returns a non-None guide
    try:
        guide = get_guidance(
            emergency_category=prediction.emergency_type or "General",
            severity_level=prediction.severity_level.value
            if hasattr(prediction.severity_level, "value")
            else str(prediction.severity_level),
            age=age,
            conditions=conditions or None,
        )
    except Exception as exc:
        logger.error("first_aid_service.get_guidance raised: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Guidance generation failed.  Please try again.",
        )

    # 6. Build and return response
    return FirstAidGuideResponse(
        session_id=session_id,
        emergency_category=guide.emergency_category,
        severity_level=guide.severity_level,
        call_emergency=guide.call_emergency,
        severity_note=guide.severity_note,
        steps=[FirstAidStepSchema(title=s.title, detail=s.detail) for s in guide.steps],
        precautions=guide.precautions,
        avoid=guide.avoid,
        disclaimer=guide.disclaimer,
    )
