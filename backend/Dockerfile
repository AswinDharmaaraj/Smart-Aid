# backend/Dockerfile
# Multi‑stage Dockerfile for the FastAPI backend
# -------------------------------------------------
# Stage 1 – build & install dependencies using uv (fast Python package manager)
FROM python:3.12-slim AS builder
WORKDIR /app

# Install build tools needed for some wheels (gcc, make, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends gcc && rm -rf /var/lib/apt/lists/*

# Install uv (fast, deterministic package manager)
RUN pip install --no-cache-dir uv

# Copy lock files first to leverage Docker caching
COPY backend/pyproject.toml backend/uv.lock ./
# Install exact dependencies
RUN uv pip install --no-cache-dir -r uv.lock

# Copy the source code
COPY backend/ .

# Stage 2 – runtime image
FROM python:3.12-slim AS runtime
WORKDIR /app

# Copy only the installed environment from builder (no build tools)
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /app /app

# Expose the port (host will set $PORT env var on most platforms)
ENV PORT=8000
EXPOSE 8000

# Run the FastAPI app with uvicorn. 0.0.0.0 makes it reachable from outside the container.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
