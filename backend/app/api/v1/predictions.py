from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session as DBSession

from app.db.session import get_db
from app.models.session import Session as SessionModel
from app.models.symptom_input import SymptomInput
from app.models.severity_prediction import SeverityPrediction, SeverityEnum
from app.models.user import User, RoleEnum
from app.schemas.severity_prediction import SeverityPredictionResponse
from app.services.severity_engine import predict_severity
from app.api.v1.deps import get_current_user_optional

router = APIRouter(prefix="/sessions", tags=["predictions"])


@router.post("/{session_id}/predict", response_model=SeverityPredictionResponse, status_code=status.HTTP_201_CREATED)
def predict(
    session_id: int,
    db: DBSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    session = db.query(SessionModel).filter(SessionModel.session_id == session_id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    # If the session was started as guest and user is authenticated, associate it
    if session.user_id is None and current_user:
        session.user_id = current_user.user_id
        db.commit()
    elif session.user_id is not None and current_user and session.user_id != current_user.user_id:
        if current_user.role != RoleEnum.admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot run prediction on another user's session",
            )

    symptom = (
        db.query(SymptomInput)
        .filter(SymptomInput.session_id == session_id)
        .order_by(SymptomInput.submitted_at.desc())
        .first()
    )
    if not symptom:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No symptom input found for this session")

    result = predict_severity(symptom.raw_text, symptom.category)

    prediction = SeverityPrediction(
        session_id=session_id,
        emergency_type=result["emergency_type"],
        severity_level=SeverityEnum(result["severity_level"]),
        confidence_score=result["confidence_score"],
        reasoning=result["reasoning"],
    )
    db.add(prediction)
    db.commit()
    db.refresh(prediction)
    prediction.vitals_estimated = result.get("vitals_estimated", True)
    return prediction