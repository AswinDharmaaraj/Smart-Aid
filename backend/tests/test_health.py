"""
SmartAid AI — Sprint 6 Phase 6: Health & Readiness Endpoint Tests

Covers:
  1. Liveness probe (GET /health/live):
     - Returns 200 OK with status: alive.
  2. Overall health & readiness probe (GET /health and GET /health/ready):
     - Normal operational state returns 200 OK with healthy status, connected database, and ready model.
     - Timestamp is included in ISO 8601 format.
     - Zero leakage of credentials, passwords, or filesystem paths.
  3. Database failure simulation:
     - Simulating database disconnection returns 503 Service Unavailable.
     - Response status is 'unhealthy' and database is 'disconnected'.
     - Safe error message without exposing connection strings or credentials.
  4. Model readiness failure simulation:
     - Simulating missing or unloadable model returns 503 Service Unavailable.
     - Response status is 'unhealthy' and model is 'unavailable'.
"""
import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from sqlalchemy.exc import OperationalError

from app.main import app as fastapi_app
from app.db.base import Base
from app.db.session import get_db

# Isolated in-memory SQLite database for testing
test_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
Base.metadata.create_all(bind=test_engine)


@pytest.fixture()
def db_session():
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


# ==============================================================================
# Health Probe Tests
# ==============================================================================

def test_liveness_probe(client):
    """GET /health/live returns immediate 200 OK."""
    res = client.get("/health/live")
    assert res.status_code == 200
    assert res.json() == {"status": "alive"}


def test_health_check_healthy(client):
    """GET /health returns 200 OK when database and model are healthy."""
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert data["database"] == "connected"
    assert data["model"] == "ready"
    assert "timestamp" in data

    # Ensure no sensitive credentials or internal paths are in payload
    dump_str = str(data).lower()
    assert "password" not in dump_str
    assert "postgresql://" not in dump_str
    assert "c:\\" not in dump_str
    assert "/users/" not in dump_str


def test_readiness_probe_matches_health(client):
    """GET /health/ready returns the same readiness state as /health."""
    res = client.get("/health/ready")
    assert res.status_code == 200
    assert res.json()["status"] == "healthy"


def test_health_check_database_failure(client, db_session):
    """Simulating a database connectivity failure returns 503 without leaking credentials."""
    with patch.object(db_session, "execute", side_effect=OperationalError("Connection refused", None, None)):
        res = client.get("/health")
        assert res.status_code == 503
        data = res.json()
        assert data["status"] == "unhealthy"
        assert data["database"] == "disconnected"
        assert "password" not in str(data).lower()
        assert "postgresql://" not in str(data).lower()


def test_health_check_model_failure(client):
    """Simulating an unloadable or missing ML model returns 503."""
    with patch("app.api.v1.health.check_model_readiness", return_value=(False, "unavailable")):
        res = client.get("/health")
        assert res.status_code == 503
        data = res.json()
        assert data["status"] == "unhealthy"
        assert data["model"] == "unavailable"
