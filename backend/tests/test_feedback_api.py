"""
SmartAid AI — Sprint 6 Phase 3: Feedback & Admin Statistics API Tests

Covers:
  1. Admin Statistics Endpoint (GET /api/v1/admin/stats):
     - Unauthenticated requests rejected (401).
     - Regular user forbidden (403).
     - Administrator permitted (200).
     - Empty database returns valid zero aggregates without division errors.
     - Populated database returns accurate counts and average ratings.
  2. Public & Authenticated Feedback Submission (POST /api/v1/feedback):
     - Valid anonymous submission (201).
     - Valid authenticated submission associates verified user_id (201).
     - Rating out-of-bounds (<1 or >5) rejected (422).
     - Invalid category rejected (422).
     - Nonexistent session reference returns safe 404 error.
     - Valid session reference successfully associated.
     - User ID spoofing attempt rejected (422 via extra fields forbidden).
     - Invalid contact email format rejected (422).
  3. Admin Feedback Management (GET & PATCH /api/v1/admin/feedback):
     - Unauthenticated requests rejected (401).
     - Regular user forbidden (403).
     - Admin can list feedback in newest-first order.
     - Filtering by is_reviewed, category, and rating works.
     - Pagination with bounded limits works; limit > 100 rejected (422).
     - Admin can mark feedback as reviewed and add admin notes (200).
     - Nonexistent feedback ID returns 404.
     - Empty update payload rejected (400).
     - Tampering attempts to modify rating or comments rejected (422).
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.db.session import get_db
from app.main import app as fastapi_app
import app.models  # Ensure all models are registered
from app.models.user import User, RoleEnum
from app.models.qr_code import QRCode, QRStatusEnum
from app.models.session import Session as EmergencySession
from app.models.severity_prediction import SeverityPrediction, SeverityEnum
from app.models.feedback import Feedback, FeedbackCategoryEnum

# Isolated in-memory SQLite database
test_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)


@event.listens_for(test_engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
Base.metadata.create_all(bind=test_engine)


@pytest.fixture()
def db_session():
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    fastapi_app.dependency_overrides[get_db] = override_get_db
    with TestClient(fastapi_app) as test_client:
        yield test_client
    fastapi_app.dependency_overrides.clear()


def create_user(db, email: str, role: RoleEnum = RoleEnum.user, full_name: str = "Test User") -> User:
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


# ==============================================================================
# 1. Admin Statistics Endpoint Tests
# ==============================================================================

def test_admin_stats_unauthenticated_rejected(client):
    """Calling /api/v1/admin/stats without credentials returns 401."""
    res = client.get("/api/v1/admin/stats")
    assert res.status_code == 401


def test_admin_stats_regular_user_forbidden(client, db_session):
    """Calling /api/v1/admin/stats as a regular user returns 403."""
    create_user(db_session, email="user@example.com", role=RoleEnum.user)
    res = client.get("/api/v1/admin/stats", headers=auth_headers("user@example.com"))
    assert res.status_code == 403


def test_admin_stats_empty_database_handled(client, db_session):
    """Admin stats returns zeroed metrics on an empty database without error."""
    create_user(db_session, email="admin@example.com", role=RoleEnum.admin)
    res = client.get("/api/v1/admin/stats", headers=auth_headers("admin@example.com"))
    assert res.status_code == 200
    data = res.json()
    assert data["total_users"] == 1  # The admin user
    assert data["total_qr_codes"] == 0
    assert data["active_qr_codes"] == 0
    assert data["inactive_qr_codes"] == 0
    assert data["total_sessions"] == 0
    assert data["total_feedback"] == 0
    assert data["average_rating"] == 0.0
    assert data["reviewed_feedback"] == 0
    assert data["unreviewed_feedback"] == 0
    assert isinstance(data["sessions_by_severity"], dict)
    assert isinstance(data["feedback_by_category"], dict)


def test_admin_stats_aggregates_match_known_records(client, db_session):
    """Aggregates accurately calculate user, QR, session, prediction, and feedback metrics."""
    admin = create_user(db_session, email="admin@example.com", role=RoleEnum.admin)
    create_user(db_session, email="patient1@example.com", role=RoleEnum.user)
    create_user(db_session, email="patient2@example.com", role=RoleEnum.user)

    # Seed QR codes
    qr1 = QRCode(location_name="Station A", status=QRStatusEnum.active)
    qr2 = QRCode(location_name="Station B", status=QRStatusEnum.inactive)
    db_session.add_all([qr1, qr2])
    db_session.commit()
    db_session.refresh(qr1)

    # Seed sessions & predictions
    sess1 = EmergencySession(qr_code_id=qr1.qr_code_id)
    sess2 = EmergencySession(qr_code_id=qr1.qr_code_id)
    db_session.add_all([sess1, sess2])
    db_session.commit()
    db_session.refresh(sess1)
    db_session.refresh(sess2)

    pred1 = SeverityPrediction(
        session_id=sess1.session_id,
        emergency_type="Bleeding",
        severity_level=SeverityEnum.urgent,
        confidence_score=0.92,
        reasoning="Pulsatile arterial bleed",
    )
    pred2 = SeverityPrediction(
        session_id=sess2.session_id,
        emergency_type="Burns",
        severity_level=SeverityEnum.moderate,
        confidence_score=0.88,
        reasoning="Partial thickness burn",
    )
    db_session.add_all([pred1, pred2])

    # Seed feedbacks: ratings 4 and 5 -> avg 4.5
    fb1 = Feedback(
        session_id=sess1.session_id,
        rating=4,
        category=FeedbackCategoryEnum.guidance_clarity,
        is_reviewed=True,
    )
    fb2 = Feedback(
        session_id=sess2.session_id,
        rating=5,
        category=FeedbackCategoryEnum.guidance_clarity,
        is_reviewed=False,
    )
    db_session.add_all([fb1, fb2])
    db_session.commit()

    res = client.get("/api/v1/admin/stats", headers=auth_headers("admin@example.com"))
    assert res.status_code == 200
    data = res.json()
    assert data["total_users"] == 3
    assert data["total_qr_codes"] == 2
    assert data["active_qr_codes"] == 1
    assert data["inactive_qr_codes"] == 1
    assert data["total_sessions"] == 2
    assert data["sessions_by_severity"]["urgent"] == 1
    assert data["sessions_by_severity"]["moderate"] == 1
    assert data["sessions_by_category"]["Bleeding"] == 1
    assert data["sessions_by_category"]["Burns"] == 1
    assert data["total_feedback"] == 2
    assert data["average_rating"] == 4.5
    assert data["feedback_by_category"]["guidance_clarity"] == 2
    assert data["reviewed_feedback"] == 1
    assert data["unreviewed_feedback"] == 1


# ==============================================================================
# 2. Feedback Submission API Tests
# ==============================================================================

def test_feedback_anonymous_submission_success(client):
    """Anonymous user can submit feedback with rating and category without logging in."""
    payload = {
        "rating": 5,
        "category": "system_usability",
        "comments": "Very simple to use during an emergency.",
        "contact_email": "firstaider@example.org",
    }
    res = client.post("/api/v1/feedback", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["feedback_id"] is not None
    assert data["rating"] == 5
    assert data["category"] == "system_usability"
    assert data["comments"] == "Very simple to use during an emergency."
    assert data["contact_email"] == "firstaider@example.org"
    assert data["user_id"] is None
    assert data["is_reviewed"] is False


def test_feedback_authenticated_submission_success(client, db_session):
    """Authenticated user submitting feedback has their user_id securely bound."""
    user = create_user(db_session, email="patient@example.com")
    payload = {
        "rating": 4,
        "category": "hospital_locator",
        "comments": "Found the nearest facility within minutes.",
    }
    res = client.post(
        "/api/v1/feedback",
        json=payload,
        headers=auth_headers("patient@example.com"),
    )
    assert res.status_code == 201
    data = res.json()
    assert data["user_id"] == user.user_id
    assert data["rating"] == 4


def test_feedback_submission_rating_bounds_rejected(client):
    """Ratings less than 1 or greater than 5 are rejected with 422."""
    res_low = client.post("/api/v1/feedback", json={"rating": 0})
    assert res_low.status_code == 422

    res_high = client.post("/api/v1/feedback", json={"rating": 6})
    assert res_high.status_code == 422


def test_feedback_submission_invalid_category_rejected(client):
    """Invalid category string is rejected with 422."""
    res = client.post("/api/v1/feedback", json={"rating": 3, "category": "non_existent_category"})
    assert res.status_code == 422


def test_feedback_submission_invalid_email_format_rejected(client):
    """Malformed contact email is rejected with 422."""
    res = client.post("/api/v1/feedback", json={"rating": 4, "contact_email": "not-an-email"})
    assert res.status_code == 422


def test_feedback_submission_invalid_session_rejected(client):
    """Submitting with a non-existent session_id returns 404."""
    payload = {
        "session_id": 999999,
        "rating": 4,
        "category": "general",
    }
    res = client.post("/api/v1/feedback", json=payload)
    assert res.status_code == 404
    assert "not found" in res.json()["detail"].lower()


def test_feedback_submission_valid_session_associated(client, db_session):
    """Submitting with a valid session associates the session_id."""
    qr = QRCode(location_name="Lobby", status=QRStatusEnum.active)
    db_session.add(qr)
    db_session.commit()
    db_session.refresh(qr)

    session = EmergencySession(qr_code_id=qr.qr_code_id)
    db_session.add(session)
    db_session.commit()
    db_session.refresh(session)

    payload = {
        "session_id": session.session_id,
        "rating": 5,
        "category": "triage_accuracy",
    }
    res = client.post("/api/v1/feedback", json=payload)
    assert res.status_code == 201
    assert res.json()["session_id"] == session.session_id


def test_feedback_submission_user_id_spoofing_prevented(client):
    """Attempting to inject a user_id into the request body is rejected."""
    payload = {
        "rating": 5,
        "user_id": 42,  # Spoof attempt
    }
    res = client.post("/api/v1/feedback", json=payload)
    assert res.status_code == 422


# ==============================================================================
# 3. Admin Feedback Management API Tests
# ==============================================================================

def test_admin_list_feedback_unauthenticated_rejected(client):
    """Unauthenticated access to /api/v1/admin/feedback returns 401."""
    res = client.get("/api/v1/admin/feedback")
    assert res.status_code == 401


def test_admin_list_feedback_regular_user_forbidden(client, db_session):
    """Regular user access to /api/v1/admin/feedback returns 403."""
    create_user(db_session, email="regular@example.com", role=RoleEnum.user)
    res = client.get("/api/v1/admin/feedback", headers=auth_headers("regular@example.com"))
    assert res.status_code == 403


def test_admin_list_feedback_success_and_ordering(client, db_session):
    """Administrator lists feedback items in newest-first order."""
    create_user(db_session, email="admin@example.com", role=RoleEnum.admin)

    fb1 = Feedback(rating=1, category=FeedbackCategoryEnum.general, comments="Oldest")
    fb2 = Feedback(rating=5, category=FeedbackCategoryEnum.guidance_clarity, comments="Newest")
    db_session.add_all([fb1, fb2])
    db_session.commit()

    res = client.get("/api/v1/admin/feedback", headers=auth_headers("admin@example.com"))
    assert res.status_code == 200
    items = res.json()
    assert len(items) == 2
    assert items[0]["comments"] == "Newest"
    assert items[1]["comments"] == "Oldest"


def test_admin_list_feedback_filtering(client, db_session):
    """Administrator can filter feedback by review status, category, and rating."""
    create_user(db_session, email="admin@example.com", role=RoleEnum.admin)

    fb1 = Feedback(rating=5, category=FeedbackCategoryEnum.guidance_clarity, is_reviewed=True)
    fb2 = Feedback(rating=2, category=FeedbackCategoryEnum.hospital_locator, is_reviewed=False)
    fb3 = Feedback(rating=5, category=FeedbackCategoryEnum.triage_accuracy, is_reviewed=False)
    db_session.add_all([fb1, fb2, fb3])
    db_session.commit()

    headers = auth_headers("admin@example.com")

    # Filter is_reviewed=true
    res_reviewed = client.get("/api/v1/admin/feedback?is_reviewed=true", headers=headers)
    assert len(res_reviewed.json()) == 1
    assert res_reviewed.json()[0]["rating"] == 5

    # Filter category=hospital_locator
    res_cat = client.get("/api/v1/admin/feedback?category=hospital_locator", headers=headers)
    assert len(res_cat.json()) == 1
    assert res_cat.json()[0]["rating"] == 2

    # Filter rating=5
    res_rating = client.get("/api/v1/admin/feedback?rating=5", headers=headers)
    assert len(res_rating.json()) == 2


def test_admin_list_feedback_pagination_bounds(client, db_session):
    """Pagination offset and limit work; limit > 100 is rejected with 422."""
    create_user(db_session, email="admin@example.com", role=RoleEnum.admin)
    headers = auth_headers("admin@example.com")

    # Limit > 100 should be rejected by Query validation
    res_over = client.get("/api/v1/admin/feedback?limit=101", headers=headers)
    assert res_over.status_code == 422

    # Valid pagination
    res_paged = client.get("/api/v1/admin/feedback?limit=10&offset=0", headers=headers)
    assert res_paged.status_code == 200


def test_admin_patch_feedback_unauthenticated_rejected(client):
    """PATCH /api/v1/admin/feedback/{id} without auth returns 401."""
    res = client.patch("/api/v1/admin/feedback/1", json={"is_reviewed": True})
    assert res.status_code == 401


def test_admin_patch_feedback_regular_user_forbidden(client, db_session):
    """PATCH /api/v1/admin/feedback/{id} as regular user returns 403."""
    create_user(db_session, email="regular@example.com", role=RoleEnum.user)
    res = client.patch(
        "/api/v1/admin/feedback/1",
        json={"is_reviewed": True},
        headers=auth_headers("regular@example.com"),
    )
    assert res.status_code == 403


def test_admin_patch_feedback_success(client, db_session):
    """Administrator can successfully mark feedback as reviewed and record admin notes."""
    create_user(db_session, email="admin@example.com", role=RoleEnum.admin)
    fb = Feedback(rating=3, category=FeedbackCategoryEnum.general, comments="Need clearer triage")
    db_session.add(fb)
    db_session.commit()
    db_session.refresh(fb)

    payload = {
        "is_reviewed": True,
        "admin_notes": "Reviewed and updated triage step 2 instructions.",
    }
    res = client.patch(
        f"/api/v1/admin/feedback/{fb.feedback_id}",
        json=payload,
        headers=auth_headers("admin@example.com"),
    )
    assert res.status_code == 200
    data = res.json()
    assert data["is_reviewed"] is True
    assert data["admin_notes"] == "Reviewed and updated triage step 2 instructions."
    assert data["rating"] == 3  # Original content preserved
    assert data["comments"] == "Need clearer triage"


def test_admin_patch_feedback_not_found(client, db_session):
    """Updating a non-existent feedback ID returns 404."""
    create_user(db_session, email="admin@example.com", role=RoleEnum.admin)
    res = client.patch(
        "/api/v1/admin/feedback/999999",
        json={"is_reviewed": True},
        headers=auth_headers("admin@example.com"),
    )
    assert res.status_code == 404


def test_admin_patch_feedback_empty_payload_rejected(client, db_session):
    """PATCH with no fields provided returns 400 Bad Request."""
    create_user(db_session, email="admin@example.com", role=RoleEnum.admin)
    fb = Feedback(rating=4, category=FeedbackCategoryEnum.general)
    db_session.add(fb)
    db_session.commit()
    db_session.refresh(fb)

    res = client.patch(
        f"/api/v1/admin/feedback/{fb.feedback_id}",
        json={},
        headers=auth_headers("admin@example.com"),
    )
    assert res.status_code == 400
    assert "at least one field" in res.json()["detail"].lower()


def test_admin_patch_feedback_tampering_rejected(client, db_session):
    """Attempting to modify rating or comments via review endpoint is rejected."""
    create_user(db_session, email="admin@example.com", role=RoleEnum.admin)
    fb = Feedback(rating=2, category=FeedbackCategoryEnum.general, comments="Bad experience")
    db_session.add(fb)
    db_session.commit()
    db_session.refresh(fb)

    payload = {
        "rating": 5,  # Tamper attempt
        "is_reviewed": True,
    }
    res = client.patch(
        f"/api/v1/admin/feedback/{fb.feedback_id}",
        json=payload,
        headers=auth_headers("admin@example.com"),
    )
    assert res.status_code == 422  # Extra fields forbidden

    # Verify original rating is untouched
    db_session.refresh(fb)
    assert fb.rating == 2
