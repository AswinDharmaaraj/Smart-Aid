"""
SmartAid AI — Sprint 3 Prediction Tests

Tests:
  1.  Model artifact (.joblib) exists on disk
  2.  Model loads successfully without errors
  3.  Valid sample input produces a valid severity
  4.  Predicted severity is one of: low / moderate / urgent / critical
  5.  Confidence score is between 0.0 and 1.0
  6.  Missing/NaN feature values do not crash prediction
  7.  Critical safety override forces 'critical' severity
  8.  Non-existent session ID returns 404
  9.  Prediction API returns expected response schema
  10. Prediction record is saved in severity_predictions DB table
"""

import pytest
from pathlib import Path
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# ── Model imports ──────────────────────────────────────────────────────────────
import app.models.user          # noqa: F401
import app.models.qr_code       # noqa: F401
import app.models.session       # noqa: F401
import app.models.symptom_input  # noqa: F401
import app.models.severity_prediction  # noqa: F401

from app.main import app
from app.db.base import Base
from app.db.session import get_db
from app.models.qr_code import QRCode, QRStatusEnum
from app.models.session import Session as SessionModel
from app.models.symptom_input import SymptomInput
from app.models.severity_prediction import SeverityPrediction

# ── Paths ──────────────────────────────────────────────────────────────────────
BACKEND_DIR = Path(__file__).resolve().parent.parent
MODEL_PATH  = BACKEND_DIR / "app" / "ml_models" / "severity_model_pipeline.joblib"
ENCODER_PATH = BACKEND_DIR / "app" / "ml_models" / "label_encoder.joblib"

VALID_SEVERITY_LEVELS = {"low", "moderate", "urgent", "critical"}

# ── In-memory SQLite database (shared across all tests in this module) ─────────
engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
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
def session_with_symptom(db_session):
    """Fixture: active QR code + session + symptom input, ready for prediction."""
    qr = QRCode(location_name="Test Clinic", status=QRStatusEnum.active)
    db_session.add(qr)
    db_session.commit()
    db_session.refresh(qr)

    sess = SessionModel(qr_code_id=qr.qr_code_id)
    db_session.add(sess)
    db_session.commit()
    db_session.refresh(sess)

    symptom = SymptomInput(
        session_id=sess.session_id,
        raw_text="chest pain and difficulty breathing and excessive sweating",
        category="Cardiac",
    )
    db_session.add(symptom)
    db_session.commit()
    db_session.refresh(symptom)

    return sess.session_id


@pytest.fixture()
def session_with_non_critical_symptom(db_session):
    """Fixture: session with mild symptom that should NOT trigger override."""
    qr = QRCode(location_name="Test Clinic B", status=QRStatusEnum.active)
    db_session.add(qr)
    db_session.commit()
    db_session.refresh(qr)

    sess = SessionModel(qr_code_id=qr.qr_code_id)
    db_session.add(sess)
    db_session.commit()
    db_session.refresh(sess)

    symptom = SymptomInput(
        session_id=sess.session_id,
        raw_text="mild headache and slight dizziness",
        category="General",
    )
    db_session.add(symptom)
    db_session.commit()
    db_session.refresh(symptom)

    return sess.session_id


# ==============================================================================
# TEST 1: Model artifact exists on disk
# ==============================================================================
def test_model_artifact_exists():
    """Model artifact must exist at the expected path before any API call."""
    assert MODEL_PATH.exists(), f"Model artifact not found at {MODEL_PATH}."
    assert ENCODER_PATH.exists(), f"Label encoder artifact not found at {ENCODER_PATH}."


# ==============================================================================
# TEST 2: Model loads successfully
# ==============================================================================
def test_model_loads_successfully():
    """The saved pipeline must load without errors and expose predict()."""
    import joblib
    pipeline = joblib.load(MODEL_PATH)
    label_encoder = joblib.load(ENCODER_PATH)
    assert hasattr(pipeline, "predict"), "Loaded object is not a valid sklearn Pipeline"
    assert hasattr(pipeline, "predict_proba"), "Pipeline must expose predict_proba()"
    assert hasattr(label_encoder, "classes_"), "Label encoder must have classes_"


# ==============================================================================
# TEST 3: Valid sample produces a valid severity
# ==============================================================================
def test_valid_input_produces_valid_severity():
    """Calling predict_severity() with a real symptom string returns a valid dict."""
    from app.services.severity_engine import predict_severity

    result = predict_severity(
        raw_text="severe chest pain and difficulty breathing",
        selected_category="Cardiac",
    )
    assert "severity_level" in result
    assert "confidence_score" in result
    assert "reasoning" in result


# ==============================================================================
# TEST 4: Predicted severity is in the allowed set
# ==============================================================================
def test_prediction_class_is_valid():
    """severity_level must always be one of: low / moderate / urgent / critical."""
    from app.services.severity_engine import predict_severity

    result = predict_severity(raw_text="person fell from a ladder and has a broken leg")
    assert result["severity_level"] in VALID_SEVERITY_LEVELS, (
        f"Unexpected severity level: {result['severity_level']}"
    )


# ==============================================================================
# TEST 5: Confidence score is between 0 and 1
# ==============================================================================
def test_confidence_score_in_valid_range():
    """Confidence score from predict_proba() must be between 0.0 and 1.0."""
    from app.services.severity_engine import predict_severity

    result = predict_severity(raw_text="mild headache and dizziness")
    assert 0.0 <= result["confidence_score"] <= 1.0, (
        f"Confidence score out of range: {result['confidence_score']}"
    )


# ==============================================================================
# TEST 6: Missing / NaN values do not crash prediction
# ==============================================================================
def test_missing_values_do_not_crash():
    """Pipeline imputers must handle None/NaN without raising exceptions."""
    from app.services.severity_engine import predict_severity

    # All optional structured fields omitted — pipeline should impute them
    result = predict_severity(
        raw_text="patient is unconscious",
        selected_category=None,
        age=None,
        sex=None,
        symptom_duration_min=None,
        heart_rate_bpm=None,
        temperature_c=None,
        spo2_percent=None,
    )
    assert result["severity_level"] in VALID_SEVERITY_LEVELS


# ==============================================================================
# TEST 7: Critical safety override still works
# ==============================================================================
def test_critical_safety_override():
    """If a life-threatening keyword is in the text, result must be 'critical'."""
    from app.services.severity_engine import predict_severity

    override_texts = [
        "patient is unresponsive and not breathing",
        "person collapsed and has no pulse",
        "victim unconscious after electric shock",
    ]
    for text in override_texts:
        result = predict_severity(raw_text=text)
        assert result["severity_level"] == "critical", (
            f"Safety override failed for: '{text}'. Got: {result['severity_level']}"
        )


# ==============================================================================
# TEST 8: Non-existent session returns 404
# ==============================================================================
def test_invalid_session_returns_404(client):
    """POST /predict on a non-existent session must return 404."""
    resp = client.post("/api/v1/sessions/999999/predict")
    assert resp.status_code == 404, resp.text
    assert resp.json()["detail"] == "Session not found"


# ==============================================================================
# TEST 9: Prediction API returns expected response schema
# ==============================================================================
def test_prediction_api_returns_expected_schema(client, session_with_symptom):
    """POST /api/v1/sessions/{id}/predict must return required fields."""
    resp = client.post(f"/api/v1/sessions/{session_with_symptom}/predict")
    assert resp.status_code == 201, resp.text

    body = resp.json()

    # Required fields
    assert "prediction_id" in body
    assert "session_id" in body
    assert "severity_level" in body
    assert "confidence_score" in body
    assert "reasoning" in body
    assert "predicted_at" in body
    assert "vitals_estimated" in body
    assert body["vitals_estimated"] is True

    # Severity must be valid
    assert body["severity_level"] in VALID_SEVERITY_LEVELS

    # Confidence in range
    assert 0.0 <= body["confidence_score"] <= 1.0

    # session_id matches
    assert body["session_id"] == session_with_symptom


# ==============================================================================
# TEST 10: Prediction record is stored in the database
# ==============================================================================
def test_prediction_is_stored_in_database(client, db_session, session_with_non_critical_symptom):
    """After a successful prediction API call, a row must exist in severity_predictions."""
    sid = session_with_non_critical_symptom

    before = db_session.query(SeverityPrediction).filter(
        SeverityPrediction.session_id == sid
    ).count()

    resp = client.post(f"/api/v1/sessions/{sid}/predict")
    assert resp.status_code == 201, resp.text

    after = db_session.query(SeverityPrediction).filter(
        SeverityPrediction.session_id == sid
    ).count()

    assert after == before + 1, (
        f"Expected one new prediction row; before={before}, after={after}"
    )

    # Verify stored values are sane
    stored = (
        db_session.query(SeverityPrediction)
        .filter(SeverityPrediction.session_id == sid)
        .order_by(SeverityPrediction.prediction_id.desc())
        .first()
    )
    assert stored is not None
    assert stored.severity_level.value in VALID_SEVERITY_LEVELS
    assert 0.0 <= stored.confidence_score <= 1.0
    assert stored.reasoning  # must not be empty string
