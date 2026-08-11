from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session as DBSession
from app.db.session import get_db
from app.models.user import User
from app.models.session import Session as SessionModel
from app.models.symptom_input import SymptomInput
from app.models.severity_prediction import SeverityPrediction
from app.schemas.history import HistoryEntry
from app.api.v1.deps import get_current_user

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me/history", response_model=list[HistoryEntry])
def get_my_history(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    sessions = (
        db.query(SessionModel)
        .filter(SessionModel.user_id == current_user.user_id)
        .order_by(SessionModel.started_at.desc())
        .all()
    )

    results = []
    for session in sessions:
        symptom = (
            db.query(SymptomInput)
            .filter(SymptomInput.session_id == session.session_id)
            .order_by(SymptomInput.submitted_at.desc())
            .first()
        )
        prediction = (
            db.query(SeverityPrediction)
            .filter(SeverityPrediction.session_id == session.session_id)
            .order_by(SeverityPrediction.predicted_at.desc())
            .first()
        )
        results.append(HistoryEntry(
            session_id=session.session_id,
            started_at=session.started_at,
            category=symptom.category if symptom else None,
            raw_text=symptom.raw_text if symptom else None,
            severity_level=prediction.severity_level.value if prediction else None,
            confidence_score=prediction.confidence_score if prediction else None,
        ))
    return results