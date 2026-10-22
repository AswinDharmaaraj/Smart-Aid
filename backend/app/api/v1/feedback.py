from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session as DBSession

from app.db.session import get_db
from app.api.v1.deps import get_current_user_optional
from app.models.user import User
from app.models.session import Session as EmergencySession
from app.models.feedback import Feedback
from app.schemas.feedback import FeedbackCreate, FeedbackResponse

router = APIRouter(prefix="/feedback", tags=["feedback"])


@router.post("", response_model=FeedbackResponse, status_code=status.HTTP_201_CREATED)
def submit_feedback(
    feedback_in: FeedbackCreate,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: DBSession = Depends(get_db),
):
    """
    Submit user feedback on first aid guidance or system experience.
    
    Supports anonymous submissions or authenticated user feedback.
    Feedback is used exclusively for service quality improvements and
    first-aid clarity, not as clinical diagnostic evaluation.
    """
    # 1. Validate session reference if supplied
    if feedback_in.session_id is not None:
        session = db.query(EmergencySession).filter(EmergencySession.session_id == feedback_in.session_id).first()
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Referenced emergency session not found",
            )

    # 2. Derive user association strictly from authenticated token, never untrusted input
    authenticated_user_id = current_user.user_id if current_user else None

    # 3. Create feedback record
    feedback = Feedback(
        session_id=feedback_in.session_id,
        user_id=authenticated_user_id,
        rating=feedback_in.rating,
        category=feedback_in.category,
        comments=feedback_in.comments.strip() if feedback_in.comments else None,
        contact_email=str(feedback_in.contact_email) if feedback_in.contact_email else None,
    )

    db.add(feedback)
    db.commit()
    db.refresh(feedback)

    return feedback
