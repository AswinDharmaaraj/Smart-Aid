from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session as DBSession

from app.db.session import get_db
from app.models.session import Session as SessionModel
from app.models.symptom_input import SymptomInput
from app.models.user import User, RoleEnum
from app.schemas.symptom_input import SymptomInputCreate, SymptomInputResponse
from app.schemas.qr_code import SessionResponse
from app.api.v1.deps import get_current_user, get_current_user_optional

router = APIRouter(prefix="/sessions", tags=["symptoms"])


@router.post("/{session_id}/claim", response_model=SessionResponse)
def claim_session(
    session_id: int,
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Safely link an unowned guest session to the authenticated user's account.
    If the session is already claimed by another user, raises 403 Forbidden.
    """
    session = db.query(SessionModel).filter(SessionModel.session_id == session_id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    if session.user_id is not None and session.user_id != current_user.user_id:
        if current_user.role != RoleEnum.admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot claim a session owned by another user",
            )

    session.user_id = current_user.user_id
    db.commit()
    db.refresh(session)
    return session


@router.post("/{session_id}/symptoms", response_model=SymptomInputResponse, status_code=status.HTTP_201_CREATED)
def save_symptom_input(
    session_id: int,
    payload: SymptomInputCreate,
    db: DBSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    session = db.query(SessionModel).filter(SessionModel.session_id == session_id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    # If the session was started as a guest and the user is authenticated, associate it
    if session.user_id is None and current_user:
        session.user_id = current_user.user_id
        db.commit()
    elif session.user_id is not None and current_user and session.user_id != current_user.user_id:
        if current_user.role != RoleEnum.admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot modify another user's session",
            )

    new_input = SymptomInput(
        session_id=session_id,
        raw_text=payload.raw_text,
        category=payload.category,
    )
    db.add(new_input)
    db.commit()
    db.refresh(new_input)
    return new_input