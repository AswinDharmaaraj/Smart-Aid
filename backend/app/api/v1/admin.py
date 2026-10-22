from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session as DBSession

from app.db.session import get_db
from app.models.user import User, RoleEnum
from app.models.qr_code import QRCode, QRStatusEnum
from app.models.session import Session as EmergencySession
from app.models.severity_prediction import SeverityPrediction, SeverityEnum
from app.models.feedback import Feedback, FeedbackCategoryEnum
from app.schemas.user import UserResponse
from app.schemas.qr_code import QRCodeResponse
from app.schemas.feedback import FeedbackAdminUpdate, FeedbackResponse
from app.schemas.admin_stats import AdminStatsResponse
from app.api.v1.deps import require_admin

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/users", response_model=list[UserResponse])
def list_users(
    admin: User = Depends(require_admin),
    db: DBSession = Depends(get_db),
):
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [UserResponse.model_validate(u) for u in users]


@router.get("/qr-codes", response_model=list[QRCodeResponse])
def list_qr_codes(
    admin: User = Depends(require_admin),
    db: DBSession = Depends(get_db),
):
    return db.query(QRCode).order_by(QRCode.installed_at.desc()).all()


@router.patch("/qr-codes/{qr_code_id}/toggle", response_model=QRCodeResponse)
def toggle_qr_status(
    qr_code_id: int,
    admin: User = Depends(require_admin),
    db: DBSession = Depends(get_db),
):
    from fastapi import HTTPException, status
    from app.models.qr_code import QRStatusEnum
    qr = db.query(QRCode).filter(QRCode.qr_code_id == qr_code_id).first()
    if not qr:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="QR code not found")
    qr.status = QRStatusEnum.inactive if qr.status == QRStatusEnum.active else QRStatusEnum.active
    db.commit()
    db.refresh(qr)
    return qr


@router.patch("/users/{target_user_id}/promote", response_model=UserResponse)
def promote_user(
    target_user_id: int,
    admin: User = Depends(require_admin),
    db: DBSession = Depends(get_db),
):
    from fastapi import HTTPException, status
    target_user = db.query(User).filter(User.user_id == target_user_id).first()
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    if target_user.role == RoleEnum.admin:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User is already an admin")

    target_user.role = RoleEnum.admin
    db.commit()
    db.refresh(target_user)
    return target_user


@router.get("/stats", response_model=AdminStatsResponse)
def get_admin_stats(
    admin: User = Depends(require_admin),
    db: DBSession = Depends(get_db),
):
    """
    Aggregate administrative statistics for users, QR codes, emergency triage sessions,
    severity distributions, and first aid feedback.
    """
    total_users = db.query(func.count(User.user_id)).scalar() or 0

    total_qr_codes = db.query(func.count(QRCode.qr_code_id)).scalar() or 0
    qr_status_counts = dict(
        db.query(QRCode.status, func.count(QRCode.qr_code_id))
        .group_by(QRCode.status)
        .all()
    )
    active_qr_codes = qr_status_counts.get(QRStatusEnum.active, 0)
    inactive_qr_codes = qr_status_counts.get(QRStatusEnum.inactive, 0)

    total_sessions = db.query(func.count(EmergencySession.session_id)).scalar() or 0

    sev_counts = dict(
        db.query(SeverityPrediction.severity_level, func.count(SeverityPrediction.prediction_id))
        .group_by(SeverityPrediction.severity_level)
        .all()
    )
    sessions_by_severity = {
        sev.value: sev_counts.get(sev, 0)
        for sev in SeverityEnum
    }

    cat_counts = dict(
        db.query(SeverityPrediction.emergency_type, func.count(SeverityPrediction.prediction_id))
        .filter(SeverityPrediction.emergency_type.isnot(None))
        .group_by(SeverityPrediction.emergency_type)
        .all()
    )
    sessions_by_category = {
        str(cat): count for cat, count in cat_counts.items() if cat
    }

    total_feedback = db.query(func.count(Feedback.feedback_id)).scalar() or 0
    raw_avg = db.query(func.avg(Feedback.rating)).scalar()
    average_rating = round(float(raw_avg), 2) if raw_avg is not None else 0.0

    fb_cat_counts = dict(
        db.query(Feedback.category, func.count(Feedback.feedback_id))
        .group_by(Feedback.category)
        .all()
    )
    feedback_by_category = {
        cat.value: fb_cat_counts.get(cat, 0)
        for cat in FeedbackCategoryEnum
    }

    reviewed_feedback = (
        db.query(func.count(Feedback.feedback_id))
        .filter(Feedback.is_reviewed.is_(True))
        .scalar()
        or 0
    )
    unreviewed_feedback = (
        db.query(func.count(Feedback.feedback_id))
        .filter(Feedback.is_reviewed.is_(False))
        .scalar()
        or 0
    )

    return AdminStatsResponse(
        total_users=total_users,
        total_qr_codes=total_qr_codes,
        active_qr_codes=active_qr_codes,
        inactive_qr_codes=inactive_qr_codes,
        total_sessions=total_sessions,
        sessions_by_severity=sessions_by_severity,
        sessions_by_category=sessions_by_category,
        total_feedback=total_feedback,
        average_rating=average_rating,
        feedback_by_category=feedback_by_category,
        reviewed_feedback=reviewed_feedback,
        unreviewed_feedback=unreviewed_feedback,
    )


@router.get("/feedback", response_model=list[FeedbackResponse])
def list_feedback(
    is_reviewed: Optional[bool] = Query(None, description="Filter by review status"),
    category: Optional[FeedbackCategoryEnum] = Query(None, description="Filter by category"),
    rating: Optional[int] = Query(None, ge=1, le=5, description="Filter by exact rating (1-5)"),
    limit: int = Query(50, ge=1, le=100, description="Page limit (max 100)"),
    offset: int = Query(0, ge=0, description="Page offset"),
    admin: User = Depends(require_admin),
    db: DBSession = Depends(get_db),
):
    """
    List user feedback submissions with optional filters (status, category, rating)
    and bounded pagination.
    """
    query = db.query(Feedback)
    if is_reviewed is not None:
        query = query.filter(Feedback.is_reviewed == is_reviewed)
    if category is not None:
        query = query.filter(Feedback.category == category)
    if rating is not None:
        query = query.filter(Feedback.rating == rating)

    feedbacks = (
        query.order_by(Feedback.created_at.desc(), Feedback.feedback_id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return feedbacks


@router.patch("/feedback/{feedback_id}", response_model=FeedbackResponse)
def update_feedback_review(
    feedback_id: int,
    update_in: FeedbackAdminUpdate,
    admin: User = Depends(require_admin),
    db: DBSession = Depends(get_db),
):
    """
    Administrative triage update for feedback items: mark as reviewed and attach notes.
    Rating, user ID, session ID, comments, and email cannot be altered.
    """
    feedback = db.query(Feedback).filter(Feedback.feedback_id == feedback_id).first()
    if not feedback:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Feedback record not found",
        )

    if update_in.is_reviewed is None and update_in.admin_notes is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one field ('is_reviewed' or 'admin_notes') must be provided for update",
        )

    if update_in.is_reviewed is not None:
        feedback.is_reviewed = update_in.is_reviewed
    if update_in.admin_notes is not None:
        feedback.admin_notes = update_in.admin_notes.strip() if update_in.admin_notes else None

    db.commit()
    db.refresh(feedback)
    return feedback
