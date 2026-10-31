"""
SmartAid AI — Sprint 5: Incident Report Endpoint Tests

Tests cover:
  1. Successful report retrieval for a complete session (QR + symptoms + prediction + guidance).
  2. Non-existent session returns 404.
  3. Partial session handling (session with no symptoms / no predictions).
  4. Guest walk-in session (user_id=None) accessibility without auth.
  5. Privacy & authorization:
     - Owner can access private session report.
     - Different authenticated user receives 403 Forbidden.
     - Unauthenticated caller receives 401 Unauthorized for private session.
     - Admin can access any private session report.
  6. Schema validation, report_id format, and medical disclaimer presence.
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.qr_code import QRCode, QRStatusEnum
from app.models.session import NetworkModeEnum, Session as SessionModel
from app.models.severity_prediction import SeverityEnum, SeverityPrediction
from app.models.symptom_input import SymptomInput
from app.models.user import RoleEnum, User

# In-memory SQLite for test isolation
engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)


@pytest.fixture()
def db_session():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


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


@pytest.fixture
def test_users(db_session):
    # User 1 (Alice)
    alice = User(
        full_name="Alice Patient",
        email="alice@example.com",
        password_hash=hash_password("password123"),
        role=RoleEnum.user,
    )
    # User 2 (Bob)
    bob = User(
        full_name="Bob Bystander",
        email="bob@example.com",
        password_hash=hash_password("password123"),
        role=RoleEnum.user,
    )
    # Admin (Dr. Charles)
    admin = User(
        full_name="Dr. Charles",
        email="admin@example.com",
        password_hash=hash_password("password123"),
        role=RoleEnum.admin,
    )
    db_session.add_all([alice, bob, admin])
    db_session.commit()
    db_session.refresh(alice)
    db_session.refresh(bob)
    db_session.refresh(admin)

    tokens = {
        "alice": create_access_token({"sub": alice.email}),
        "bob": create_access_token({"sub": bob.email}),
        "admin": create_access_token({"sub": admin.email}),
    }
    users = {"alice": alice, "bob": bob, "admin": admin}
    return users, tokens


@pytest.fixture
def seeded_qr(db_session):
    qr = QRCode(
        location_name="Station Block B",
        install_site="First Floor corridor near elevator",
        status=QRStatusEnum.active,
    )
    db_session.add(qr)
    db_session.commit()
    db_session.refresh(qr)
    return qr.qr_code_id


# ==============================================================================
# 1. RETRIEVAL & SCHEMA TESTS
# ==============================================================================
def test_report_404_nonexistent_session(client):
    """Requesting an unknown session ID returns 404."""
    res = client.get("/api/v1/sessions/99999/report")
    assert res.status_code == 404
    assert "not found" in res.json()["detail"].lower()


def test_guest_walkin_session_report_complete(client, db_session, seeded_qr):
    """
    A public walk-in emergency session (user_id=None) can be retrieved by ID
    and includes QR location, symptoms, prediction, and first-aid guidance.
    """
    session = SessionModel(
        qr_code_id=seeded_qr,
        user_id=None,
        network_mode=NetworkModeEnum.online,
    )
    db_session.add(session)
    db_session.commit()
    db_session.refresh(session)
    s_id = session.session_id

    # Add symptom input
    symptom = SymptomInput(
        session_id=s_id,
        raw_text="crushing chest pain radiating to arm, age: 52",
        category="Cardiac",
    )
    db_session.add(symptom)

    # Add severity prediction
    pred = SeverityPrediction(
        session_id=s_id,
        emergency_type="Cardiac",
        severity_level=SeverityEnum.critical,
        confidence_score=0.96,
        reasoning="Critical cardiac presentation detected.",
    )
    db_session.add(pred)
    db_session.commit()

    res = client.get(f"/api/v1/sessions/{s_id}/report")
    assert res.status_code == 200
    data = res.json()

    assert data["session_id"] == s_id
    assert data["report_id"].startswith("SA-")
    assert data["network_mode"] == "online"
    assert data["qr_info"]["location_name"] == "Station Block B"
    assert data["symptoms"]["category"] == "Cardiac"
    assert "chest pain" in data["symptoms"]["raw_text"]
    assert data["prediction"]["severity_level"] == "critical"
    assert data["prediction"]["confidence_score"] == 0.96

    # Guidance should be auto-assembled
    assert data["guidance"] is not None
    assert data["guidance"]["call_emergency"] is True
    assert len(data["guidance"]["steps"]) > 0
    assert "disclaimer" in data


def test_partial_session_report_without_prediction(client, db_session, seeded_qr):
    """
    A session that has recorded symptoms but no prediction yet still returns
    a valid report with prediction=None and guidance=None without crashing.
    """
    session = SessionModel(
        qr_code_id=seeded_qr,
        user_id=None,
        network_mode=NetworkModeEnum.online,
    )
    db_session.add(session)
    db_session.commit()
    db_session.refresh(session)
    s_id = session.session_id

    symptom = SymptomInput(
        session_id=s_id,
        raw_text="mild knee scrape",
        category="Injury",
    )
    db_session.add(symptom)
    db_session.commit()

    res = client.get(f"/api/v1/sessions/{s_id}/report")
    assert res.status_code == 200
    data = res.json()
    assert data["session_id"] == s_id
    assert data["symptoms"] is not None
    assert data["prediction"] is None
    assert data["guidance"] is None


# ==============================================================================
# 2. PRIVACY & ACCESS CONTROL TESTS
# ==============================================================================
def test_private_session_owner_can_access(client, db_session, test_users, seeded_qr):
    """The user who owns a private session can retrieve its report."""
    users, tokens = test_users
    alice = users["alice"]

    session = SessionModel(
        qr_code_id=seeded_qr,
        user_id=alice.user_id,
    )
    db_session.add(session)
    db_session.commit()
    db_session.refresh(session)
    s_id = session.session_id

    headers = {"Authorization": f"Bearer {tokens['alice']}"}
    res = client.get(f"/api/v1/sessions/{s_id}/report", headers=headers)
    assert res.status_code == 200
    assert res.json()["session_id"] == s_id


def test_private_session_unauthenticated_denied(client, db_session, test_users, seeded_qr):
    """An unauthenticated request to an account-bound session receives 401."""
    users, tokens = test_users
    alice = users["alice"]

    session = SessionModel(
        qr_code_id=seeded_qr,
        user_id=alice.user_id,
    )
    db_session.add(session)
    db_session.commit()
    db_session.refresh(session)
    s_id = session.session_id

    res = client.get(f"/api/v1/sessions/{s_id}/report")
    assert res.status_code == 401
    assert "authentication required" in res.json()["detail"].lower()


def test_private_session_different_user_forbidden(client, db_session, test_users, seeded_qr):
    """Another user (Bob) attempting to view Alice's private session receives 403."""
    users, tokens = test_users
    alice = users["alice"]

    session = SessionModel(
        qr_code_id=seeded_qr,
        user_id=alice.user_id,
    )
    db_session.add(session)
    db_session.commit()
    db_session.refresh(session)
    s_id = session.session_id

    bob_headers = {"Authorization": f"Bearer {tokens['bob']}"}
    res = client.get(f"/api/v1/sessions/{s_id}/report", headers=bob_headers)
    assert res.status_code == 403
    assert "permission" in res.json()["detail"].lower()


def test_private_session_admin_can_access(client, db_session, test_users, seeded_qr):
    """An admin (Dr. Charles) can view any session report for triage/audit."""
    users, tokens = test_users
    alice = users["alice"]

    session = SessionModel(
        qr_code_id=seeded_qr,
        user_id=alice.user_id,
    )
    db_session.add(session)
    db_session.commit()
    db_session.refresh(session)
    s_id = session.session_id

    admin_headers = {"Authorization": f"Bearer {tokens['admin']}"}
    res = client.get(f"/api/v1/sessions/{s_id}/report", headers=admin_headers)
    assert res.status_code == 200
    assert res.json()["session_id"] == s_id
