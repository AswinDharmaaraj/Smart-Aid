from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session as DBSession
from app.db.session import get_db
from app.models.session import Session as SessionModel
from app.models.symptom_input import SymptomInput
from app.models.severity_prediction import SeverityPrediction, SeverityEnum
from app.schemas.severity_prediction import SeverityPredictionResponse
from app.services.severity_engine import predict_severity

router = APIRouter(prefix="/sessions", tags=["predictions"])


@router.post("/{session_id}/predict", response_model=SeverityPredictionResponse, status_code=status.HTTP_201_CREATED)
def predict(session_id: int, db: DBSession = Depends(get_db)):
    session = db.query(SessionModel).filter(SessionModel.session_id == session_id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

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