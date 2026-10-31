"""
SmartAid AI — pytest conftest.py

Sets required environment variables BEFORE any app module is imported,
so pydantic-settings picks up the test values on all platforms (Linux CI, Windows dev).
"""
import os
import pytest

# ── Set test environment variables early ─────────────────────────────────────
# These must be set before `from app.core.config import settings` is executed
# anywhere in the test suite, because pydantic-settings reads env at import time.

os.environ.setdefault("DATABASE_URL", "sqlite:///./test.db")
os.environ.setdefault("SECRET_KEY", "ci-test-secret-key-for-running-automated-test-suite")
os.environ.setdefault("APP_BASE_URL", "http://localhost:8080")
os.environ.setdefault(
    "ALLOWED_ORIGINS",
    '["http://localhost:8080","http://localhost:5173"]',
)
