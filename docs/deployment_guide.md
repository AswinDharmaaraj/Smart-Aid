# SmartAid AI — Production Deployment & Operational Runbook

**Project:** SmartAid AI — Intelligent QR-Based First Aid Decision Support System  
**Version:** Sprint 6 Production Readiness  
**Target Environment:** Containerized Backend (FastAPI + PostgreSQL) & Edge Frontend (Cloudflare Pages / Node SSR)

---

## 1. Architecture Overview

```
                      ┌─────────────────────────────────────────┐
                      │            Public Clients               │
                      │  (Mobile Web / Emergency QR Stations)   │
                      └────────────────────┬────────────────────┘
                                           │ HTTPS
                                           ▼
                      ┌─────────────────────────────────────────┐
                      │    Edge Frontend (TanStack Start / SSR) │
                      │       Cloudflare Pages / Nitro Engine   │
                      └────────────────────┬────────────────────┘
                                           │ REST API (HTTPS / CORS)
                                           ▼
                      ┌─────────────────────────────────────────┐
                      │        FastAPI Application Server       │
                      │       (Containerized, Non-Root)         │
                      │   - Triage Safety Net & XGBoost Engine  │
                      │   - Dynamic QR Generator                │
                      │   - Health Probes (/health, /live)      │
                      │   - Admin & Feedback APIs               │
                      └─────────────┬─────────────┬─────────────┘
                                    │             │
                    Joblib Artifacts│             │ SQL / Connection Pool
                                    ▼             ▼
                      ┌─────────────────┐   ┌───────────────────────────┐
                      │ XGBoost Pipeline│   │   PostgreSQL 16 Database  │
                      │ & Label Encoder │   │ (Persistent Storage Vol)  │
                      └─────────────────┘   └───────────────────────────┘
```

---

## 2. Prerequisites

| Component | Minimum Version | Purpose |
|---|---|---|
| **Python** | 3.12+ | Backend runtime & test execution |
| **Node.js** | 20.x or 22.x | Frontend build and SSR server runtime |
| **PostgreSQL** | 16.x | Primary relational database |
| **Docker & Docker Compose** | 24.x+ / 2.20+ | Containerized microservices runtime |

---

## 3. Environment Configuration

### Backend Configuration (`backend/.env`)
Copy `backend/.env.production.example` to `backend/.env`:

```bash
cp backend/.env.production.example backend/.env
```

Key environment variables:
* `SECRET_KEY`: 64-character cryptographically secure hex string (`openssl rand -hex 32`).
* `DATABASE_URL`: Connection URI (`postgresql://user:password@host:5432/smartaid`).
* `APP_BASE_URL`: Public canonical frontend URL (e.g. `https://smartaid.app`).
* `ALLOWED_ORIGINS`: Comma-delimited list of permitted CORS origins (e.g. `https://smartaid.app,https://admin.smartaid.app`).
* `HOSPITAL_PROVIDER`: Geodata lookup provider (`nominatim`, `overpass`, or `local_osm`).

### Root Docker Compose Configuration (`.env`)
Copy `.env.production.example` to `.env`:

```bash
cp .env.production.example .env
```

---

## 4. Database Setup & Alembic Migrations

Before launching the API, execute Alembic migrations to apply all table schemas, constraints, indexes, and initial seed data:

```bash
cd backend
# Using project virtual environment:
python -m alembic upgrade head
```

### Migration Lineage
1. `7cdf6020b051`: Core tables (`users`, `qr_codes`, `sessions`).
2. `b31dcca1b7fe`: `symptom_inputs` table.
3. `a060ab99bb2d`: `severity_predictions` table.
4. `f2a03214cdc2`: Foreign key indexing optimization.
5. `c4e8a1f02d73`: Seed permanent Walk-In Direct Start QR code row (`qr_code_id = 1`).
6. `16e66c67e984`: Sprint 6 Feedback (`feedbacks`) and Notification Log (`notification_logs`) tables.

---

## 5. Docker Deployment

### Launching with Docker Compose
To run PostgreSQL and the FastAPI backend in detached mode:

```bash
docker compose up -d --build
```

### Checking Container Health
Inspect container status and health probes:

```bash
docker compose ps
```

The database container includes automated `pg_isready` checks, and the backend container runs a curl-based healthcheck every 30 seconds.

---

## 6. Service Health & Readiness Probes

The FastAPI backend exposes cloud-native health and readiness endpoints:

| Endpoint | HTTP Success | Check Performed | Use Case |
|---|---|---|---|
| `GET /health/live` | `200 OK` | Process liveness only | Kubernetes liveness probe / container restart daemon |
| `GET /health/ready` | `200 OK` | Database connectivity (`SELECT 1`) + XGBoost ML model readiness | Kubernetes readiness probe / load-balancer routing |
| `GET /health` | `200 OK` | Comprehensive system health check | External uptime monitoring |

*Note:* If the database is disconnected or the model artifacts are missing, `/health` and `/health/ready` return `HTTP 503 Service Unavailable` with sanitized status indicators, safely omitting connection strings and passwords.

---

## 7. Frontend Deployment Strategy

The SmartAid frontend is built with **TanStack Start** and **Nitro**:

### Recommended: Cloudflare Pages / Workers
1. Set the build command to `npm run build`.
2. Output directory: `.output/public`.
3. Set environment variable: `VITE_API_URL=https://api.smartaid.app`.
4. Deploy using the generated `.output/server/wrangler.json`.

### Self-Hosted Node.js / Docker
Run the compiled Nitro production server directly:

```bash
cd frontend-new
npm run build
node .output/server/index.mjs
```

---

## 8. Production Security Checklist

- [x] **Non-Root Execution:** Backend container runs under dedicated unprivileged `smartaid` system user.
- [x] **Data Protection:** Database credentials and connection strings are excluded from Docker image layers and `.dockerignore`.
- [x] **CORS Lockdown:** `CORSMiddleware` restricts origin headers to authorized domain names.
- [x] **Access Control:** All `/api/v1/admin/*` routes enforce strict JWT role verification (`require_admin`).
- [x] **Input Sanitization:** Rating ranges, feedback categories, and parameter bounds are strictly enforced via Pydantic v2 `extra="forbid"`.
- [x] **Data Persistence:** PostgreSQL data is stored on a named volume (`postgres_data`) protected against container recreation.
