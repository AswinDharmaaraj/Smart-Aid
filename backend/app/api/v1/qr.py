import qrcode
import io
import base64
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session as DBSession
from app.db.session import get_db
from app.models.qr_code import QRCode, QRStatusEnum
from app.models.session import Session as SessionModel
from app.models.user import User
from app.schemas.qr_code import QRCodeCreate, QRCodeResponse, SessionResponse
from app.api.v1.deps import require_admin, get_current_user_optional

router = APIRouter(prefix="/qr", tags=["qr"])


@router.post("", response_model=QRCodeResponse, status_code=status.HTTP_201_CREATED)
def create_qr_code(
    qr_in: QRCodeCreate,
    db: DBSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    new_qr = QRCode(
        location_name=qr_in.location_name,
        install_site=qr_in.install_site,
    )
    db.add(new_qr)
    db.commit()
    db.refresh(new_qr)
    return new_qr


@router.get("/{qr_code_id}/image")
def get_qr_image(qr_code_id: int, db: DBSession = Depends(get_db)):
    qr_code = db.query(QRCode).filter(QRCode.qr_code_id == qr_code_id).first()
    if not qr_code:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="QR code not found")

    scan_url = "https://corny-marxism-headed.ngrok-free.dev/session/" + str(qr_code_id)
    img = qrcode.make(scan_url)
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    encoded = base64.b64encode(buffer.getvalue()).decode()

    return {"qr_code_id": qr_code_id, "scan_url": scan_url, "image_base64": encoded}


@router.get("/{qr_code_id}/session", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
def start_session(
    qr_code_id: int,
    db: DBSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    qr_code = db.query(QRCode).filter(QRCode.qr_code_id == qr_code_id).first()
    if not qr_code:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="QR code not found")
    if qr_code.status != QRStatusEnum.active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This QR code is inactive")

    new_session = SessionModel(
        qr_code_id=qr_code_id,
        user_id=current_user.user_id if current_user else None,
    )
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    return new_session


@router.patch("/sessions/{session_id}/network-mode", response_model=SessionResponse)
def update_network_mode(session_id: int, mode: str, db: DBSession = Depends(get_db)):
    session = db.query(SessionModel).filter(SessionModel.session_id == session_id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    if mode not in ("online", "offline"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid mode")
    session.network_mode = mode
    db.commit()
    db.refresh(session)
    return session