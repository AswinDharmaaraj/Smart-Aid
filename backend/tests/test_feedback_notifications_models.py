"""
SmartAid AI — Sprint 6 Phase 2: Feedback & Notification Log Models and Schemas Tests

Covers:
  1. Model Imports and Metadata Registration:
     - Feedback and NotificationLog are registered in Base.metadata.
     - Column definitions, types, and defaults.
  2. Feedback Model Invariants:
     - Creation with valid rating (1..5) and categories.
     - Invariant enforcement: rating constraint (1 <= rating <= 5) via DB CheckConstraint.
     - Anonymous feedback allowed (session_id=None, user_id=None).
     - Optional associations (user_id and session_id).
     - Foreign key enforcement (linking valid and invalid session/user).
  3. NotificationLog Model Invariants:
     - Notification creation with valid types and statuses.
     - Idempotency key uniqueness constraint enforcement.
     - recipient_phone_masked property behavior for privacy preservation.
  4. Pydantic Schemas Validation:
     - FeedbackCreate rating bounds [1, 5] and category validation.
     - FeedbackCreate email validation.
     - FeedbackResponse serialization from ORM attributes.
     - NotificationLogCreate field constraints (idempotency_key length, phone length).
     - NotificationLogResponse privacy masking (only masked phone exposed).
"""
import pytest
from pydantic import ValidationError
from sqlalchemy import create_engine, event
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
import app.models  # Registers all models with Base.metadata
from app.models.user import User, RoleEnum
from app.models.qr_code import QRCode, QRStatusEnum
from app.models.session import Session as EmergencySession
from app.models.feedback import Feedback, FeedbackCategoryEnum
from app.models.notification import NotificationLog, NotificationTypeEnum, NotificationStatusEnum
from app.schemas.feedback import FeedbackCreate, FeedbackAdminUpdate, FeedbackResponse
from app.schemas.notification import NotificationLogCreate, NotificationLogResponse


# Create an isolated SQLite database that enforces foreign keys
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
def db():
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def sample_user_and_session(db):
    user = User(
        email="patient@example.com",
        password_hash="fakehash123",
        full_name="Test Patient",
        role=RoleEnum.user,
    )
    qr = QRCode(location_name="Station A", status=QRStatusEnum.active)
    db.add_all([user, qr])
    db.commit()
    db.refresh(user)
    db.refresh(qr)

    session = EmergencySession(qr_code_id=qr.qr_code_id, user_id=user.user_id)
    db.add(session)
    db.commit()
    db.refresh(session)
    return user, session


# ==============================================================================
# 1. Metadata Registration Tests
# ==============================================================================

def test_models_registered_in_metadata():
    """Verify feedbacks and notification_logs tables are registered in Base.metadata."""
    table_names = Base.metadata.tables.keys()
    assert "feedbacks" in table_names
    assert "notification_logs" in table_names
    assert "users" in table_names
    assert "sessions" in table_names


def test_feedback_table_columns():
    """Verify columns and constraints of the feedbacks table."""
    table = Base.metadata.tables["feedbacks"]
    column_names = {c.name for c in table.columns}
    expected_cols = {
        "feedback_id", "session_id", "user_id", "rating", "category",
        "comments", "contact_email", "is_reviewed", "admin_notes", "created_at"
    }
    assert expected_cols.issubset(column_names)
    assert table.c.feedback_id.primary_key is True


def test_notification_log_table_columns():
    """Verify columns and indexes of the notification_logs table."""
    table = Base.metadata.tables["notification_logs"]
    column_names = {c.name for c in table.columns}
    expected_cols = {
        "notification_id", "session_id", "recipient_phone", "message_type",
        "message_body", "status", "provider", "idempotency_key",
        "error_details", "created_at"
    }
    assert expected_cols.issubset(column_names)
    assert table.c.notification_id.primary_key is True


# ==============================================================================
# 2. Feedback Model Tests
# ==============================================================================

def test_create_anonymous_feedback_success(db):
    """Anonymous feedback without user account or emergency session must succeed."""
    fb = Feedback(
        rating=5,
        category=FeedbackCategoryEnum.guidance_clarity,
        comments="Clear first-aid instructions.",
        contact_email="anonymous@example.org",
    )
    db.add(fb)
    db.commit()
    db.refresh(fb)

    assert fb.feedback_id is not None
    assert fb.session_id is None
    assert fb.user_id is None
    assert fb.rating == 5
    assert fb.category == FeedbackCategoryEnum.guidance_clarity
    assert fb.is_reviewed is False
    assert fb.created_at is not None


def test_create_feedback_with_session_and_user(db, sample_user_and_session):
    """Feedback linked to valid user and emergency session succeeds."""
    user, session = sample_user_and_session
    fb = Feedback(
        session_id=session.session_id,
        user_id=user.user_id,
        rating=4,
        category=FeedbackCategoryEnum.hospital_locator,
        comments="Found hospital within 3 km.",
    )
    db.add(fb)
    db.commit()
    db.refresh(fb)

    assert fb.session_id == session.session_id
    assert fb.user_id == user.user_id
    assert fb.rating == 4


def test_feedback_rating_boundary_database_constraint(db):
    """Database check constraint must reject rating < 1 or rating > 5."""
    # Rating 0 should fail check constraint
    fb_low = Feedback(rating=0, category=FeedbackCategoryEnum.general)
    db.add(fb_low)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()

    # Rating 6 should fail check constraint
    fb_high = Feedback(rating=6, category=FeedbackCategoryEnum.general)
    db.add(fb_high)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()

    # Rating 1 and 5 should succeed
    fb_min = Feedback(rating=1, category=FeedbackCategoryEnum.general)
    fb_max = Feedback(rating=5, category=FeedbackCategoryEnum.general)
    db.add_all([fb_min, fb_max])
    db.commit()
    assert fb_min.feedback_id is not None
    assert fb_max.feedback_id is not None


def test_feedback_foreign_key_invalid_session(db):
    """Referencing a non-existent session_id must trigger an IntegrityError."""
    fb = Feedback(session_id=999999, rating=3, category=FeedbackCategoryEnum.general)
    db.add(fb)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_feedback_foreign_key_invalid_user(db):
    """Referencing a non-existent user_id must trigger an IntegrityError."""
    fb = Feedback(user_id=999999, rating=3, category=FeedbackCategoryEnum.general)
    db.add(fb)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


# ==============================================================================
# 3. Notification Log Model Tests
# ==============================================================================

def test_notification_log_creation_and_defaults(db, sample_user_and_session):
    """Verify notification log creation and default field population."""
    _, session = sample_user_and_session
    notif = NotificationLog(
        session_id=session.session_id,
        recipient_phone="+919876543210",
        message_type=NotificationTypeEnum.emergency_alert,
        message_body="Emergency reported at Station A. Situation under guidance.",
        provider="mock",
        idempotency_key="idemp_test_key_001_unique",
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)

    assert notif.notification_id is not None
    assert notif.status == NotificationStatusEnum.simulated
    assert notif.provider == "mock"
    assert notif.created_at is not None
    assert notif.recipient_phone_masked == "+91********10"


def test_notification_phone_masking_variants():
    """Verify privacy masking works across multiple phone formats."""
    log1 = NotificationLog(recipient_phone="+14155552671")
    assert log1.recipient_phone_masked == "+14*******71"

    log2 = NotificationLog(recipient_phone="98765")
    assert log2.recipient_phone_masked == "****"

    log3 = NotificationLog(recipient_phone="")
    assert log3.recipient_phone_masked == ""


def test_notification_log_idempotency_key_uniqueness(db):
    """Duplicate idempotency keys must be rejected by uniqueness constraint."""
    key = "idemp_same_key_99998888"
    notif1 = NotificationLog(
        recipient_phone="+919876543210",
        message_body="Test message 1",
        idempotency_key=key,
    )
    db.add(notif1)
    db.commit()

    notif2 = NotificationLog(
        recipient_phone="+919876543210",
        message_body="Test message 2 (duplicate)",
        idempotency_key=key,
    )
    db.add(notif2)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_notification_log_foreign_key_session(db):
    """Referencing a non-existent session_id triggers an IntegrityError."""
    notif = NotificationLog(
        session_id=888888,
        recipient_phone="+919876543210",
        message_body="Invalid session notification",
        idempotency_key="idemp_invalid_session_111",
    )
    db.add(notif)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


# ==============================================================================
# 4. Feedback Pydantic Schema Validation Tests
# ==============================================================================

def test_feedback_create_schema_valid():
    """Valid FeedbackCreate data passes validation."""
    data = FeedbackCreate(
        session_id=12,
        rating=4,
        category=FeedbackCategoryEnum.hospital_locator,
        comments="Fast navigation to hospital.",
        contact_email="test@user.com",
    )
    assert data.rating == 4
    assert data.category == FeedbackCategoryEnum.hospital_locator


def test_feedback_create_schema_rating_bounds():
    """Ratings outside 1-5 must fail schema validation."""
    with pytest.raises(ValidationError):
        FeedbackCreate(rating=0)

    with pytest.raises(ValidationError):
        FeedbackCreate(rating=6)

    # Valid boundaries
    assert FeedbackCreate(rating=1).rating == 1
    assert FeedbackCreate(rating=5).rating == 5


def test_feedback_create_schema_invalid_category():
    """Invalid category value fails schema validation."""
    with pytest.raises(ValidationError):
        FeedbackCreate(rating=4, category="invalid_category_xyz")


def test_feedback_create_schema_invalid_email():
    """Invalid contact email format fails validation."""
    with pytest.raises(ValidationError):
        FeedbackCreate(rating=3, contact_email="not-an-email")


def test_feedback_response_from_orm(db):
    """FeedbackResponse successfully models ORM instances via from_attributes."""
    fb = Feedback(
        rating=5,
        category=FeedbackCategoryEnum.system_usability,
        comments="Intuitive interface.",
        contact_email="care@example.com",
    )
    db.add(fb)
    db.commit()
    db.refresh(fb)

    response = FeedbackResponse.model_validate(fb)
    assert response.feedback_id == fb.feedback_id
    assert response.rating == 5
    assert response.category == FeedbackCategoryEnum.system_usability
    assert response.is_reviewed is False
    assert response.user_id is None


def test_feedback_admin_update_schema():
    """Admin update schema accepts review status and administrator notes."""
    update = FeedbackAdminUpdate(
        is_reviewed=True,
        admin_notes="Reviewed by system administrator on 2026-10-23.",
    )
    assert update.is_reviewed is True
    assert "Reviewed by" in update.admin_notes


# ==============================================================================
# 5. Notification Log Pydantic Schema Validation Tests
# ==============================================================================

def test_notification_log_create_schema_valid():
    """NotificationLogCreate validates required and bounded fields."""
    notif = NotificationLogCreate(
        session_id=1,
        recipient_phone="+919876543210",
        message_type=NotificationTypeEnum.emergency_alert,
        message_body="Urgent first aid assistance underway.",
        idempotency_key="idempotency_key_1234567890",
    )
    assert notif.recipient_phone == "+919876543210"
    assert notif.provider == "mock"
    assert notif.message_type == NotificationTypeEnum.emergency_alert


def test_notification_log_create_schema_short_idempotency_key():
    """Idempotency keys shorter than 16 chars are rejected."""
    with pytest.raises(ValidationError):
        NotificationLogCreate(
            recipient_phone="+919876543210",
            message_body="Test message",
            idempotency_key="short",  # < 16 chars
        )


def test_notification_log_create_schema_phone_length():
    """Invalid phone lengths (<7 or >20 chars) are rejected."""
    with pytest.raises(ValidationError):
        NotificationLogCreate(
            recipient_phone="123",  # < 7 chars
            message_body="Test message",
            idempotency_key="valid_length_key_123456",
        )


def test_notification_log_response_masks_phone_privacy(db):
    """NotificationLogResponse must expose recipient_phone_masked and not raw phone."""
    notif = NotificationLog(
        recipient_phone="+919876543210",
        message_type=NotificationTypeEnum.report_share,
        message_body="Emergency report link: https://smartaid.app/report/1",
        status=NotificationStatusEnum.simulated,
        provider="mock",
        idempotency_key="idemp_mask_test_key_0001",
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)

    response = NotificationLogResponse.model_validate(notif)
    assert response.recipient_phone_masked == "+91********10"
    # Ensure unmasked phone field is not present in schema dump
    dump = response.model_dump()
    assert "recipient_phone_masked" in dump
    assert "recipient_phone" not in dump
    assert response.status == NotificationStatusEnum.simulated
