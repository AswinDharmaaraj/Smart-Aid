from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session as DBSession
from app.db.session import get_db
from app.models.session import Session as SessionModel
from app.models.symptom_input import SymptomInput
from app.schemas.symptom_input import SymptomInputCreate, SymptomInputResponse

router = APIRouter(prefix="/sessions", tags=["symptoms"])


@router.post("/{session_id}/symptoms", response_model=SymptomInputResponse, status_code=status.HTTP_201_CREATED)
def save_symptom_input(
    session_id: int,
    payload: SymptomInputCreate,
    db: DBSession = Depends(get_db),
):
    session = db.query(SessionModel).filter(SessionModel.session_id == session_id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    new_input = SymptomInput(
        session_id=session_id,
        raw_text=payload.raw_text,
        category=payload.category,
    )
    db.add(new_input)
    db.commit()
    db.refresh(new_input)
    return new_input