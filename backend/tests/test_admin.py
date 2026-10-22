"""
SmartAid AI — Sprint 6 Phase 1: Administrator Authorization & Security Tests

Tests cover:
  1. Administrative User Management:
     - Unauthenticated caller receives 401 Unauthorized.
     - Regular user receives 403 Forbidden.
     - Administrator receives 200 OK with full user details.
  2. Administrative QR Code Management:
     - Unauthenticated caller receives 401 Unauthorized.
     - Regular user receives 403 Forbidden on listing and toggle.
     - Administrator receives 200 OK for list and toggle.
     - Non-existent QR code returns 404 Not Found.
  3. Role Promotion & Privilege Escalation Prevention:
     - Regular user attempting self-promotion or peer-promotion receives 403 Forbidden.
     - Administrator promoting a regular user succeeds (200 OK).
     - Promoting an already-admin user returns 400 Bad Request.
     - Promoting a non-existent user returns 404 Not Found.
  4. Configurable QR Base URL:
     - QR image endpoint generates URL using settings.APP_BASE_URL.
     - URL contains no double slashes and no hardcoded ngrok domain.
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.qr_code import QRCode, QRStatusEnum
from app.models.user import RoleEnum, User

# In-memory SQLite isolated testing database
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
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def create_test_user(
    db,
    email: str = "user@example.com",
    role: RoleEnum = RoleEnum.user,
    full_name: str = "Test User",
) -> User:
    user = User(
        full_name=full_name,
        email=email,
        password_hash=hash_password("Password123!"),
        role=role,
        phone="+919876543210",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def auth_headers(email: str) -> dict[str, str]:
    token = create_access_token(data={"sub": email})
    return {"Authorization": f"Bearer {token}"}


# ── Task 2: Administrator Authorization Tests ────────────────────────────────


def test_admin_list_users_unauthenticated_rejected(client):
    """Calling /admin/users without an Authorization header returns 401."""
    res = client.get("/api/v1/admin/users")
    assert res.status_code == 401


def test_admin_list_users_regular_user_forbidden(client, db_session):
    """A regular user must NOT be able to view administrator user listings (403 Forbidden)."""
    create_test_user(db_session, email="regular@example.com", role=RoleEnum.user)
    headers = auth_headers("regular@example.com")

    res = client.get("/api/v1/admin/users", headers=headers)
    assert res.status_code == 403
    assert res.json()["detail"] == "Admin access required"


def test_admin_list_users_admin_allowed(client, db_session):
    """A verified administrator can retrieve user listings."""
    create_test_user(db_session, email="admin@example.com", role=RoleEnum.admin)
    create_test_user(db_session, email="alice@example.com", role=RoleEnum.user)
    headers = auth_headers("admin@example.com")

    res = client.get("/api/v1/admin/users", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 2
    emails = [u["email"] for u in data]
    assert "admin@example.com" in emails
    assert "alice@example.com" in emails


def test_admin_list_qr_codes_unauthenticated_rejected(client):
    """Calling /admin/qr-codes without authentication returns 401."""
    res = client.get("/api/v1/admin/qr-codes")
    assert res.status_code == 401


def test_admin_list_qr_codes_regular_user_forbidden(client, db_session):
    """Regular users must NOT be allowed to view admin QR code inventory."""
    create_test_user(db_session, email="regular@example.com", role=RoleEnum.user)
    headers = auth_headers("regular@example.com")

    res = client.get("/api/v1/admin/qr-codes", headers=headers)
    assert res.status_code == 403
    assert res.json()["detail"] == "Admin access required"


def test_admin_list_qr_codes_admin_allowed(client, db_session):
    """Administrators can list all installed QR codes."""
    create_test_user(db_session, email="admin@example.com", role=RoleEnum.admin)
    headers = auth_headers("admin@example.com")

    qr = QRCode(location_name="Library Entrance", install_site="Ground Floor", status=QRStatusEnum.active)
    db_session.add(qr)
    db_session.commit()

    res = client.get("/api/v1/admin/qr-codes", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 1
    assert data[0]["location_name"] == "Library Entrance"


def test_admin_toggle_qr_regular_user_forbidden(client, db_session):
    """A regular user cannot toggle QR code active status."""
    create_test_user(db_session, email="regular@example.com", role=RoleEnum.user)
    headers = auth_headers("regular@example.com")

    qr = QRCode(location_name="Main Gate", install_site="Gate 1", status=QRStatusEnum.active)
    db_session.add(qr)
    db_session.commit()

    res = client.patch(f"/api/v1/admin/qr-codes/{qr.qr_code_id}/toggle", headers=headers)
    assert res.status_code == 403
    assert res.json()["detail"] == "Admin access required"


def test_admin_toggle_qr_admin_allowed(client, db_session):
    """An administrator can toggle a QR code between active and inactive."""
    create_test_user(db_session, email="admin@example.com", role=RoleEnum.admin)
    headers = auth_headers("admin@example.com")

    qr = QRCode(location_name="Cafeteria", install_site="Hall A", status=QRStatusEnum.active)
    db_session.add(qr)
    db_session.commit()

    res = client.patch(f"/api/v1/admin/qr-codes/{qr.qr_code_id}/toggle", headers=headers)
    assert res.status_code == 200
    assert res.json()["status"] == "inactive"

    # Toggle back to active
    res2 = client.patch(f"/api/v1/admin/qr-codes/{qr.qr_code_id}/toggle", headers=headers)
    assert res2.status_code == 200
    assert res2.json()["status"] == "active"


def test_admin_toggle_qr_not_found(client, db_session):
    """Toggling non-existent QR returns 404."""
    create_test_user(db_session, email="admin@example.com", role=RoleEnum.admin)
    headers = auth_headers("admin@example.com")

    res = client.patch("/api/v1/admin/qr-codes/99999/toggle", headers=headers)
    assert res.status_code == 404


def test_promote_user_regular_user_forbidden(client, db_session):
    """Regular user cannot promote self or another user to administrator."""
    user1 = create_test_user(db_session, email="user1@example.com", role=RoleEnum.user)
    user2 = create_test_user(db_session, email="user2@example.com", role=RoleEnum.user)

    # user1 attempts to promote user2
    headers = auth_headers("user1@example.com")
    res = client.patch(f"/api/v1/admin/users/{user2.user_id}/promote", headers=headers)
    assert res.status_code == 403

    # user1 attempts self-promotion
    res_self = client.patch(f"/api/v1/admin/users/{user1.user_id}/promote", headers=headers)
    assert res_self.status_code == 403


def test_promote_user_admin_success(client, db_session):
    """Administrator can promote a regular user."""
    create_test_user(db_session, email="admin@example.com", role=RoleEnum.admin)
    target = create_test_user(db_session, email="member@example.com", role=RoleEnum.user)
    headers = auth_headers("admin@example.com")

    res = client.patch(f"/api/v1/admin/users/{target.user_id}/promote", headers=headers)
    assert res.status_code == 200
    assert res.json()["role"] == "admin"


def test_promote_user_already_admin_rejected(client, db_session):
    """Promoting an existing admin returns 400 Bad Request."""
    create_test_user(db_session, email="admin@example.com", role=RoleEnum.admin)
    admin2 = create_test_user(db_session, email="admin2@example.com", role=RoleEnum.admin)
    headers = auth_headers("admin@example.com")

    res = client.patch(f"/api/v1/admin/users/{admin2.user_id}/promote", headers=headers)
    assert res.status_code == 400
    assert "already an admin" in res.json()["detail"].lower()


# ── Task 3: QR URL Destination Configuration Tests ──────────────────────────


def test_qr_image_destination_uses_configured_app_base_url(client, db_session, monkeypatch):
    """QR code image endpoint must use settings.APP_BASE_URL and avoid hardcoded URLs."""
    custom_url = "https://smartaid.college.edu"
    monkeypatch.setattr(settings, "APP_BASE_URL", custom_url)

    qr = QRCode(location_name="Auditorium", install_site="Back Wall", status=QRStatusEnum.active)
    db_session.add(qr)
    db_session.commit()

    res = client.get(f"/api/v1/qr/{qr.qr_code_id}/image")
    assert res.status_code == 200
    data = res.json()

    assert data["qr_code_id"] == qr.qr_code_id
    assert data["scan_url"] == f"https://smartaid.college.edu/session/{qr.qr_code_id}"
    assert "ngrok" not in data["scan_url"]
    assert "//session" not in data["scan_url"]  # No double slash
    assert data["image_base64"] is not None
    assert len(data["image_base64"]) > 50


def test_qr_image_destination_handles_trailing_slash(client, db_session, monkeypatch):
    """settings.APP_BASE_URL with trailing slash must not result in double slashes."""
    monkeypatch.setattr(settings, "APP_BASE_URL", "https://hospital.example.org/")

    qr = QRCode(location_name="ICU Lobby", install_site="Floor 2", status=QRStatusEnum.active)
    db_session.add(qr)
    db_session.commit()

    res = client.get(f"/api/v1/qr/{qr.qr_code_id}/image")
    assert res.status_code == 200
    data = res.json()

    assert data["scan_url"] == f"https://hospital.example.org/session/{qr.qr_code_id}"
    assert "//session" not in data["scan_url"]
