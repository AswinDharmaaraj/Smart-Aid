from datetime import datetime, timezone
import logging
from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import text
from sqlalchemy.orm import Session as DBSession

from app.db.session import get_db
from app.services.severity_engine import check_model_readiness

logger = logging.getLogger(__name__)

router = APIRouter(tags=["health"])


@router.get("/health/live")
def liveness():
    """
    Lightweight liveness probe for process supervisors, load balancers, and uptime monitors.
    Returns 200 OK immediately if the web process is running.
    """
    return {"status": "alive"}


@router.get("/health/ready")
@router.get("/health")
def readiness_check(response: Response, db: DBSession = Depends(get_db)):
    """
    Readiness and overall system health check.
    Validates PostgreSQL database connectivity and XGBoost triage model availability.
    Returns HTTP 200 when ready, HTTP 503 if any core dependency fails.
    Does not expose sensitive credentials, connection parameters, or internal file paths.
    """
    db_status = "unknown"
    model_status = "unknown"
    is_healthy = True

    # 1. Database connectivity check
    try:
        db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as exc:
        logger.error("Health check database failure: %s", exc)
        db_status = "disconnected"
        is_healthy = False

    # 2. Model readiness check
    try:
        model_ready, _ = check_model_readiness()
        if model_ready:
            model_status = "ready"
        else:
            model_status = "unavailable"
            is_healthy = False
    except Exception as exc:
        logger.error("Health check model readiness failure: %s", exc)
        model_status = "unavailable"
        is_healthy = False

    if not is_healthy:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {
            "status": "unhealthy",
            "database": db_status,
            "model": model_status,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    return {
        "status": "healthy",
        "database": db_status,
        "model": model_status,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
