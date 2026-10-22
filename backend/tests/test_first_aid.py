"""
SmartAid AI — Sprint 4: First Aid Guidance Tests

Tests:
  1.  GET /guidance returns 404 for a non-existent session
  2.  GET /guidance returns 400 when no prediction exists for the session
  3.  GET /guidance returns 200 with valid schema after a prediction exists
  4.  Response always contains steps, precautions, avoid, disclaimer
  5.  call_emergency is True for critical severity
  6.  call_emergency is True for urgent severity
  7.  call_emergency may be False for low severity (General)
  8.  All 11 supported categories return non-empty steps
  9.  Unknown/unmapped category returns safe fallback content
  10. Paediatric note present when age < 12 is embedded in raw_text
  11. Condition-specific note present when conditions encoded in raw_text
  12. Critical safety signals in raw_text escalate call_emergency via prediction severity
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# ── Model imports (required to create all tables) ─────────────────────────────
import app.models.user               # noqa: F401
import app.models.qr_code            # noqa: F401
import app.models.session            # noqa: F401
import app.models.symptom_input      # noqa: F401
import app.models.severity_prediction  # noqa: F401

from app.main import app
from app.db.base import Base
from app.db.session import get_db
from app.models.qr_code import QRCode, QRStatusEnum
from app.models.session import Session as SessionModel
from app.models.symptom_input import SymptomInput
from app.models.severity_prediction import SeverityPrediction, SeverityEnum
from app.services.first_aid_service import get_guidance

# ── In-memory SQLite (same pattern as existing tests) ─────────────────────────
engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)


# ── Fixtures ───────────────────────────────────────────────────────────────────

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


def _make_session(db, location="Test Location"):
    """Create a QR code + session and return session_id."""
    qr = QRCode(location_name=location, status=QRStatusEnum.active)
    db.add(qr)
    db.commit()
    db.refresh(qr)

    sess = SessionModel(qr_code_id=qr.qr_code_id)
    db.add(sess)
    db.commit()
    db.refresh(sess)
    return sess.session_id


def _add_symptom(db, session_id, raw_text="chest pain", category="Cardiac"):
    sym = SymptomInput(session_id=session_id, raw_text=raw_text, category=category)
    db.add(sym)
    db.commit()
    db.refresh(sym)
    return sym


def _add_prediction(db, session_id, severity=SeverityEnum.urgent,
                    emergency_type="Cardiac", confidence=0.88,
                    reasoning="Test reasoning"):
    pred = SeverityPrediction(
        session_id=session_id,
        emergency_type=emergency_type,
        severity_level=severity,
        confidence_score=confidence,
        reasoning=reasoning,
    )
    db.add(pred)
    db.commit()
    db.refresh(pred)
    return pred


# ── Tests ──────────────────────────────────────────────────────────────────────

# 1. 404 for missing session
def test_guidance_404_missing_session(client):
    response = client.get("/api/v1/sessions/99999/guidance")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


# 2. 400 when no prediction exists
def test_guidance_400_no_prediction(client, db_session):
    session_id = _make_session(db_session)
    _add_symptom(db_session, session_id)

    response = client.get(f"/api/v1/sessions/{session_id}/guidance")
    assert response.status_code == 400
    assert "predict" in response.json()["detail"].lower()


# 3. 200 with valid schema after prediction exists
def test_guidance_200_valid_schema(client, db_session):
    session_id = _make_session(db_session)
    _add_symptom(db_session, session_id, raw_text="chest pain and difficulty breathing", category="Cardiac")
    _add_prediction(db_session, session_id, severity=SeverityEnum.urgent, emergency_type="Cardiac")

    response = client.get(f"/api/v1/sessions/{session_id}/guidance")
    assert response.status_code == 200

    data = response.json()
    assert data["session_id"] == session_id
    assert data["emergency_category"] == "Cardiac"
    assert data["severity_level"] == "urgent"
    assert isinstance(data["steps"], list)
    assert isinstance(data["precautions"], list)
    assert isinstance(data["avoid"], list)
    assert isinstance(data["disclaimer"], str)
    assert len(data["disclaimer"]) > 10


# 4. Response always contains non-empty steps, precautions, avoid, disclaimer
def test_guidance_non_empty_content(client, db_session):
    session_id = _make_session(db_session, "Content Test")
    _add_symptom(db_session, session_id, raw_text="burn on hand", category="Burn")
    _add_prediction(db_session, session_id, severity=SeverityEnum.moderate, emergency_type="Burn")

    data = client.get(f"/api/v1/sessions/{session_id}/guidance").json()
    assert len(data["steps"]) >= 1
    assert len(data["precautions"]) >= 1
    assert len(data["avoid"]) >= 1
    for step in data["steps"]:
        assert step["title"]
        assert step["detail"]


# 5. call_emergency is True for critical severity
def test_call_emergency_true_for_critical(client, db_session):
    session_id = _make_session(db_session, "Critical Test")
    _add_symptom(db_session, session_id, raw_text="cardiac arrest no pulse", category="Cardiac")
    _add_prediction(db_session, session_id, severity=SeverityEnum.critical, emergency_type="Cardiac")

    data = client.get(f"/api/v1/sessions/{session_id}/guidance").json()
    assert data["call_emergency"] is True


# 6. call_emergency is True for urgent severity
def test_call_emergency_true_for_urgent(client, db_session):
    session_id = _make_session(db_session, "Urgent Test")
    _add_symptom(db_session, session_id, raw_text="choking cannot breathe", category="Respiratory")
    _add_prediction(db_session, session_id, severity=SeverityEnum.urgent, emergency_type="Respiratory")

    data = client.get(f"/api/v1/sessions/{session_id}/guidance").json()
    assert data["call_emergency"] is True


# 7. call_emergency may be False for low severity on General
def test_call_emergency_false_for_low_general(client, db_session):
    session_id = _make_session(db_session, "Low Test")
    _add_symptom(db_session, session_id, raw_text="mild headache", category="General")
    _add_prediction(db_session, session_id, severity=SeverityEnum.low, emergency_type="General", confidence=0.72)

    data = client.get(f"/api/v1/sessions/{session_id}/guidance").json()
    assert data["call_emergency"] is False


# 8. All 11 supported categories return non-empty steps (unit-level test on service)
@pytest.mark.parametrize("category", [
    "Cardiac", "Respiratory", "Burn", "Injury",
    "Snake bite", "Electric shock", "Neurological",
    "Gastrointestinal", "Fever/Infection", "Poisoning", "General",
])
def test_all_categories_return_steps(category):
    guide = get_guidance(category, "moderate")
    assert len(guide.steps) >= 1, f"No steps returned for category: {category}"
    assert guide.emergency_category == category


# 9. Unknown/unmapped category returns safe fallback
def test_unknown_category_fallback():
    guide = get_guidance("Some Unknown Emergency", "moderate")
    assert len(guide.steps) >= 1
    assert guide.disclaimer  # disclaimer always present


# 10. Paediatric note present when age < 12 encoded in raw_text
def test_paediatric_note_in_response(client, db_session):
    session_id = _make_session(db_session, "Paediatric Test")
    # Embed age in raw_text as the frontend does
    _add_symptom(db_session, session_id,
                 raw_text="child fell and injured arm. Age: 7", category="Injury")
    _add_prediction(db_session, session_id, severity=SeverityEnum.moderate, emergency_type="Injury")

    data = client.get(f"/api/v1/sessions/{session_id}/guidance").json()
    precautions_text = " ".join(data["precautions"]).upper()
    assert "PAEDIATRIC" in precautions_text


# 11. Condition-specific note when conditions encoded in raw_text
def test_condition_specific_note_in_response(client, db_session):
    session_id = _make_session(db_session, "Conditions Test")
    _add_symptom(db_session, session_id,
                 raw_text="chest pain. Conditions: diabetes, heart disease", category="Cardiac")
    _add_prediction(db_session, session_id, severity=SeverityEnum.urgent, emergency_type="Cardiac")

    data = client.get(f"/api/v1/sessions/{session_id}/guidance").json()
    precautions_text = " ".join(data["precautions"]).lower()
    assert "diabetes" in precautions_text or "cardiac" in precautions_text


# 12. Critical safety: get_guidance always sets call_emergency for urgent/critical
@pytest.mark.parametrize("severity", ["urgent", "critical"])
def test_service_always_sets_call_emergency_for_high_severity(severity):
    """Safety guarantee: the service must never suppress call_emergency for urgent/critical."""
    for category in ["General", "Unknown", "Cardiac", "Respiratory"]:
        guide = get_guidance(category, severity)
        assert guide.call_emergency is True, (
            f"call_emergency was False for category={category}, severity={severity}"
        )
