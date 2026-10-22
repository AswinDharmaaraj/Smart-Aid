# SmartAid AI — Backend Dockerfile
# Production-ready multi-stage container build for FastAPI + XGBoost Triage Engine

# ── Stage 1: Build Dependencies ───────────────────────────────────────────────
FROM python:3.12-slim AS builder

WORKDIR /app

# Install system build dependencies required for compiling packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies into /install prefix
COPY requirements.txt ./
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ── Stage 2: Runtime Image ────────────────────────────────────────────────────
FROM python:3.12-slim AS runtime

WORKDIR /app

# Install runtime PostgreSQL client library and curl for health checks
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root system user for security compliance
RUN groupadd -r smartaid && useradd -r -g smartaid -d /app -s /sbin/nologin smartaid

# Copy pre-built Python dependencies from builder
COPY --from=builder /install /usr/local

# Copy application source code and runtime artifacts
COPY alembic.ini ./
COPY alembic/ ./alembic/
COPY app/ ./app/

# Set ownership to non-root user
RUN chown -R smartaid:smartaid /app

# Switch to non-root user
USER smartaid

# Configure runtime environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000

# Container liveness health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health/live || exit 1

EXPOSE 8000

# Launch application with uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
