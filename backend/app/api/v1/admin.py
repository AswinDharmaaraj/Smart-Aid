from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session as DBSession
from app.db.session import get_db
from app.models.user import User, RoleEnum
from app.models.qr_code import QRCode
from app.schemas.user import UserResponse, UserPublicResponse
from typing import Union
from app.schemas.qr_code import QRCodeResponse
from app.api.v1.deps import require_admin, require_authenticated_user

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/users", response_model=list[Union[UserResponse, UserPublicResponse]])
def list_users(
    viewer: User = Depends(require_authenticated_user),
    db: DBSession = Depends(get_db),
):
    users = db.query(User).order_by(User.created_at.desc()).all()
    if viewer.role == RoleEnum.admin:
        return [UserResponse.model_validate(u) for u in users]
    return [UserPublicResponse.model_validate(u) for u in users]


@router.get("/qr-codes", response_model=list[QRCodeResponse])
def list_qr_codes(
    viewer: User = Depends(require_authenticated_user),
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
