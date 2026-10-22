import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Import ALL models so their tables are registered with Base.metadata
import app.models.user  # noqa: F401
import app.models.qr_code  # noqa: F401
import app.models.session  # noqa: F401
import app.models.symptom_input  # noqa: F401
import app.models.severity_prediction  # noqa: F401

from app.main import app
from app.db.base import Base
from app.db.session import get_db
from app.models.qr_code import QRCode, QRStatusEnum
from app.models.session import Session as SessionModel

# StaticPool forces every connection call to reuse the same underlying
# SQLite in-memory connection, so all threads see the same database.
engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create tables once for the whole test session
Base.metadata.create_all(bind=engine)


@pytest.fixture()
def db_session():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture()
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture()
def session_id(db_session):
    qr = QRCode(location_name="Test Location", status=QRStatusEnum.active)
    db_session.add(qr)
    db_session.commit()
    db_session.refresh(qr)
    s = SessionModel(qr_code_id=qr.qr_code_id)
    db_session.add(s)
    db_session.commit()
    db_session.refresh(s)
    return s.session_id


@pytest.fixture()
def qr_code_id(db_session):
    """A bare active QRCode row with no session yet."""
    qr = QRCode(location_name="Scan Test Location", status=QRStatusEnum.active)
    db_session.add(qr)
    db_session.commit()
    db_session.refresh(qr)
    return qr.qr_code_id


def test_save_symptom_with_category_and_text(client, session_id):
    resp = client.post(f"/api/v1/sessions/{session_id}/symptoms",
                       json={"raw_text": "severe chest pain radiating to the left arm", "category": "Cardiac"})
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["session_id"] == session_id
    assert body["category"] == "Cardiac"
    assert body["raw_text"] == "severe chest pain radiating to the left arm"


def test_save_symptom_text_only_no_category(client, session_id):
    resp = client.post(f"/api/v1/sessions/{session_id}/symptoms",
                       json={"raw_text": "person is unconscious after a fall"})
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["category"] is None
    assert body["raw_text"] == "person is unconscious after a fall"


def test_save_symptom_empty_text_rejected(client, session_id):
    resp = client.post(f"/api/v1/sessions/{session_id}/symptoms",
                       json={"raw_text": ""})
    assert resp.status_code == 422, resp.text
    messages = [e.get("msg", "") for e in resp.json()["detail"]]
    assert any("Symptom description cannot be empty" in m for m in messages)


def test_save_symptom_whitespace_only_text_rejected(client, session_id):
    resp = client.post(f"/api/v1/sessions/{session_id}/symptoms",
                       json={"raw_text": "   "})
    assert resp.status_code == 422, resp.text
    messages = [e.get("msg", "") for e in resp.json()["detail"]]
    assert any("Symptom description cannot be empty" in m for m in messages)


def test_save_symptom_invalid_session_returns_404(client):
    resp = client.post("/api/v1/sessions/99999/symptoms",
                       json={"raw_text": "chest pain"})
    assert resp.status_code == 404, resp.text
    assert resp.json()["detail"] == "Session not found"


def test_save_symptom_voice_transcribed_text(client, session_id):
    voice_text = "chest pain and sweating cant breathe properly"
    resp = client.post(f"/api/v1/sessions/{session_id}/symptoms",
                       json={"raw_text": voice_text})
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["raw_text"] == voice_text
    assert body["session_id"] == session_id


# ── New regression tests for bugs fixed in this pass ─────────────────────────

def test_qr_image_scan_url_has_no_leading_space(client, qr_code_id):
    """Regression for qr.py bug: scan_url had a leading space character
    that would make the encoded QR data ' https://...' instead of 'https://...',
    causing phone cameras to fail to recognise it as a URL.
    After the fix, the URL must start with 'https://', not ' https://'.
    """
    resp = client.get(f"/api/v1/qr/{qr_code_id}/image")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    scan_url: str = body["scan_url"]
    assert not scan_url.startswith(" "), (
        f"scan_url must not start with a space; got: {scan_url!r}"
    )
    assert scan_url.startswith("https://"), (
        f"scan_url must start with 'https://'; got: {scan_url!r}"
    )


def test_start_session_creates_new_row_on_every_call(client, qr_code_id):
    """Regression: confirms start_session is stateless — each call creates
    a new row, even for the same QR code. The frontend session.$qrCodeId.tsx
    bug caused the API to never be called a second time; this test proves
    the backend side is correct and always creates a fresh session.
    """
    resp1 = client.get(f"/api/v1/qr/{qr_code_id}/session")
    assert resp1.status_code == 201, resp1.text
    session_id_1 = resp1.json()["session_id"]

    resp2 = client.get(f"/api/v1/qr/{qr_code_id}/session")
    assert resp2.status_code == 201, resp2.text
    session_id_2 = resp2.json()["session_id"]

    assert session_id_1 != session_id_2, (
        "Each scan of the same QR code must produce a distinct session row; "
        f"both calls returned session_id={session_id_1}"
    )


def test_start_session_inactive_qr_returns_400(client, db_session):
    """start_session must reject inactive QR codes with 400, not 500."""
    inactive_qr = QRCode(location_name="Inactive Location", status=QRStatusEnum.inactive)
    db_session.add(inactive_qr)
    db_session.commit()
    db_session.refresh(inactive_qr)

    resp = client.get(f"/api/v1/qr/{inactive_qr.qr_code_id}/session")
    assert resp.status_code == 400, resp.text
    assert "inactive" in resp.json()["detail"].lower()


def test_start_session_nonexistent_qr_returns_404(client):
    """start_session must return 404 for a QR code ID that doesn't exist."""
    resp = client.get("/api/v1/qr/999999/session")
    assert resp.status_code == 404, resp.text
    assert resp.json()["detail"] == "QR code not found"


# ── Direct-start (walk-in) session test ──────────────────────────────────────

DIRECT_START_QR_CODE_ID = 1  # must match frontend qrService.ts constant


def test_direct_start_creates_session_via_walkin_qr(client, db_session):
    """The homepage 'Start assessment' and scan-page 'Continue without
    scanning' buttons route through /session/1 — the well-known walk-in
    QR code seeded by the Alembic migration.  This test proves the
    backend creates a real session row when that QR code ID is used,
    exactly as it does for any other active QR code.
    """
    # Seed the walk-in QR code (mirrors the Alembic migration)
    walkin_qr = QRCode(
        qr_code_id=DIRECT_START_QR_CODE_ID,
        location_name="Direct Start (Walk-in)",
        status=QRStatusEnum.active,
    )
    db_session.merge(walkin_qr)  # merge = INSERT or UPDATE (idempotent)
    db_session.commit()

    # Count sessions before
    before = db_session.query(SessionModel).count()

    resp = client.get(f"/api/v1/qr/{DIRECT_START_QR_CODE_ID}/session")
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["qr_code_id"] == DIRECT_START_QR_CODE_ID

    # Count sessions after — must be exactly one more
    after = db_session.query(SessionModel).count()
    assert after == before + 1, (
        f"Expected session count to increase by 1; before={before}, after={after}"
    )


# ==============================================================================
# SPRINT 5 REGRESSION: AUTHENTICATED SESSION ASSOCIATION & HISTORY
# ==============================================================================
def test_authenticated_start_session_associates_user_id(client, db_session):
    """When a signed-in user starts a session, user_id is automatically associated."""
    from app.models.user import User, RoleEnum
    from app.core.security import create_access_token, hash_password

    user = User(
        email="history_user@example.com",
        password_hash=hash_password("password123"),
        full_name="History User",
        role=RoleEnum.user,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    token = create_access_token(data={"sub": user.email})
    headers = {"Authorization": f"Bearer {token}"}

    qr = QRCode(location_name="Auth Station", status=QRStatusEnum.active)
    db_session.add(qr)
    db_session.commit()
    db_session.refresh(qr)

    res = client.get(f"/api/v1/qr/{qr.qr_code_id}/session", headers=headers)
    assert res.status_code == 201
    session_id = res.json()["session_id"]

    db_sess = db_session.query(SessionModel).filter(SessionModel.session_id == session_id).first()
    assert db_sess.user_id == user.user_id


def test_authenticated_symptom_submission_links_guest_session(client, db_session):
    """If a session starts as guest, submitting symptoms with auth token claims it."""
    from app.models.user import User, RoleEnum
    from app.core.security import create_access_token, hash_password

    user = User(
        email="symptom_user@example.com",
        password_hash=hash_password("password123"),
        full_name="Symptom User",
        role=RoleEnum.user,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    token = create_access_token(data={"sub": user.email})
    headers = {"Authorization": f"Bearer {token}"}

    qr = QRCode(location_name="Guest Station", status=QRStatusEnum.active)
    db_session.add(qr)
    db_session.commit()
    db_session.refresh(qr)

    # Start unauthenticated (guest)
    res_start = client.get(f"/api/v1/qr/{qr.qr_code_id}/session")
    assert res_start.status_code == 201
    session_id = res_start.json()["session_id"]

    # Submit symptoms with authentication
    res_symptom = client.post(
        f"/api/v1/sessions/{session_id}/symptoms",
        json={"raw_text": "Severe chest pain and dizziness", "category": "Chest pain / Heart attack"},
        headers=headers,
    )
    assert res_symptom.status_code == 201

    db_sess = db_session.query(SessionModel).filter(SessionModel.session_id == session_id).first()
    assert db_sess.user_id == user.user_id


def test_claim_session_endpoint_success_and_protection(client, db_session):
    """Test POST /api/v1/sessions/{session_id}/claim links unowned session and protects owned ones."""
    from app.models.user import User, RoleEnum
    from app.core.security import create_access_token, hash_password

    user1 = User(
        email="owner1@example.com",
        password_hash=hash_password("pass1"),
        full_name="Owner One",
        role=RoleEnum.user,
    )
    user2 = User(
        email="attacker@example.com",
        password_hash=hash_password("pass2"),
        full_name="Attacker",
        role=RoleEnum.user,
    )
    db_session.add_all([user1, user2])
    db_session.commit()
    db_session.refresh(user1)
    db_session.refresh(user2)

    token1 = create_access_token(data={"sub": user1.email})
    token2 = create_access_token(data={"sub": user2.email})

    qr = QRCode(location_name="Claim Station", status=QRStatusEnum.active)
    db_session.add(qr)
    db_session.commit()
    db_session.refresh(qr)

    # 1. Create guest session
    res_start = client.get(f"/api/v1/qr/{qr.qr_code_id}/session")
    session_id = res_start.json()["session_id"]

    # 2. User 1 claims guest session
    res_claim = client.post(
        f"/api/v1/sessions/{session_id}/claim",
        headers={"Authorization": f"Bearer {token1}"},
    )
    assert res_claim.status_code == 200
    db_sess = db_session.query(SessionModel).filter(SessionModel.session_id == session_id).first()
    assert db_sess.user_id == user1.user_id

    # 3. User 2 attempts to hijack User 1's session -> 403 Forbidden
    res_hijack = client.post(
        f"/api/v1/sessions/{session_id}/claim",
        headers={"Authorization": f"Bearer {token2}"},
    )
    assert res_hijack.status_code == 403
    assert "owned by another user" in res_hijack.json()["detail"].lower()


def test_history_shows_completed_assessment_for_authenticated_user(client, db_session):
    """An assessment completed by an authenticated user shows up on GET /api/v1/users/me/history."""
    from app.models.user import User, RoleEnum
    from app.core.security import create_access_token, hash_password

    user = User(
        email="patient@example.com",
        password_hash=hash_password("password123"),
        full_name="Patient Zero",
        role=RoleEnum.user,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    token = create_access_token(data={"sub": user.email})
    headers = {"Authorization": f"Bearer {token}"}

    qr = QRCode(location_name="Emergency Ward", status=QRStatusEnum.active)
    db_session.add(qr)
    db_session.commit()
    db_session.refresh(qr)

    # Complete full assessment with token
    res_sess = client.get(f"/api/v1/qr/{qr.qr_code_id}/session", headers=headers)
    session_id = res_sess.json()["session_id"]

    client.post(
        f"/api/v1/sessions/{session_id}/symptoms",
        json={"raw_text": "Deep wound with arterial spurting", "category": "Severe bleeding"},
        headers=headers,
    )

    client.post(
        f"/api/v1/sessions/{session_id}/predict",
        headers=headers,
    )

    # Check emergency history
    res_history = client.get("/api/v1/users/me/history", headers=headers)
    assert res_history.status_code == 200
    history = res_history.json()
    assert len(history) == 1
    entry = history[0]
    assert entry["session_id"] == session_id
    assert entry["category"] == "Severe bleeding"
    assert entry["severity_level"] is not None
    assert entry["confidence_score"] is not None
