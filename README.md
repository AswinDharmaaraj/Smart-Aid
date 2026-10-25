# SmartAid AI

> **An Intelligent QR-Based First Aid Decision Support System with Emergency Risk Assessment**

SmartAid AI is a healthcare platform designed to deliver emergency first-aid guidance, automated triage severity classification using machine learning (XGBoost), hospital geolocation, dynamic QR code session initialization, feedback analytics, and an administrative oversight dashboard.

---

## Technology Stack

* **Frontend:** React 19, TypeScript, TanStack Start, TanStack Router, Vite, Tailwind CSS, Radix UI, Recharts, Lucide Icons
* **Backend:** Python 3.12+, FastAPI, SQLAlchemy 2.0, Alembic, Pydantic v2, Uvicorn
* **Database:** PostgreSQL 16
* **Machine Learning:** XGBoost severity classification pipeline (`app/ml_models/xgboost_severity_model.joblib`) with scikit-learn LabelEncoder
* **Authentication:** JWT-based stateless authentication (OAuth2 / Bearer token) with password hashing via Passlib/Bcrypt
* **Testing:** Pytest, TypeScript compiler (`tsc`), ESLint, Vite production build

---

## Architecture & Communication Flow

```
┌────────────────────────────────┐         ┌────────────────────────────────┐
│      Client / Browser          │         │     PostgreSQL 16 Database     │
│   (Mobile / Desktop Web)       │         │       (Local / Port 5432)      │
└───────────────┬────────────────┘         └───────────────▲────────────────┘
                │                                          │
                │ Requests                                 │ SQLAlchemy /
                ▼                                          │ Connection Pool
┌────────────────────────────────┐                         │
│        Frontend (Vite)         │                         │
│     http://localhost:8080      │                         │
│                                │                         │
│  Vite Reverse Proxy (/api)     │                         │
└───────────────┬────────────────┘                         │
                │ Proxies /api -> http://localhost:8000    │
                ▼                                          │
┌────────────────────────────────┐                         │
│     FastAPI Backend (Uvicorn)  │─────────────────────────┘
│      http://localhost:8000     │
│  - /api/v1/symptoms            │         ┌────────────────────────────────┐
│  - /api/v1/predictions         │────────▶│      XGBoost ML Pipeline       │
│  - /api/v1/first-aid           │         │  (Joblib Artifacts In-Memory)  │
│  - /api/v1/hospitals           │         └────────────────────────────────┘
│  - /api/v1/admin               │
│  - /api/v1/reports             │
│  - /api/v1/feedback            │
│  - /health, /health/live       │
└────────────────────────────────┘
```

### How Frontend Communicates with Backend
* **Development Reverse Proxy:** The Vite development server runs on `http://localhost:8080`. Its configuration in `frontend-new/vite.config.ts` transparently proxies all requests starting with `/api` to the backend running at `http://localhost:8000`:
  ```ts
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  }
  ```
* **Client Request Helper:** The frontend uses `frontend-new/src/lib/api.ts` which routes through `/api/v1/*`. When admin or authenticated users make requests, the client attaches the JWT bearer token in the `Authorization: Bearer <token>` header.
* **CORS Support:** The FastAPI backend also configures `CORSMiddleware` with `ALLOWED_ORIGINS` (including `http://localhost:8080`, `http://localhost:5173`, and `http://localhost:3000`) for direct cross-origin requests.

---

## Prerequisites for Local Development

Ensure the following tools are installed on your system:

| Dependency | Required Version | Verification Command |
|---|---|---|
| **Python** | 3.12 or 3.13 | `python --version` |
| **Node.js** | 20.x or 22.x LTS | `node --version` |
| **npm** | 10.x+ | `npm --version` |
| **PostgreSQL** | 16.x | `psql --version` |

---

## Step-by-Step Local Setup Guide

### 1. Install and Configure PostgreSQL 16

If PostgreSQL 16 is not already installed:

* **Windows:**
  1. Download and run the official installer from [PostgreSQL Official Downloads](https://www.postgresql.org/download/windows/).
  2. Follow the installer steps and set a password for the default `postgres` superuser (e.g. `password` or your custom password).
  3. Ensure the PostgreSQL service is running:
     ```powershell
     Get-Service -Name postgresql*
     ```
* **macOS (Homebrew):**
  ```bash
  brew install postgresql@16
  brew services start postgresql@16
  ```
* **Ubuntu / Debian:**
  ```bash
  sudo apt update
  sudo apt install postgresql postgresql-contrib
  sudo systemctl start postgresql
  sudo systemctl enable postgresql
  ```

### 2. Create the SmartAid Database

Open your terminal or `psql` shell to create the database:

```sql
-- Connect via psql
psql -U postgres

-- In the psql prompt:
CREATE DATABASE smartaid;
\q
```

Or via command line:
```bash
# Windows / PowerShell
& "C:\Program Files\PostgreSQL\16\bin\createdb.exe" -U postgres smartaid

# Linux / macOS
createdb -U postgres smartaid
```

### 3. Set Up Python Backend and Dependencies

Navigate to the `backend/` directory, create a Python virtual environment, and install the required dependencies:

#### Windows (PowerShell):
```powershell
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
.\venv\Scripts\Activate.ps1
# If PowerShell script execution is restricted, run:
# Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned

# Install dependencies
python -m pip install --upgrade pip
pip install -r requirements.txt
pip install pytest
```

#### Linux / macOS (Bash):
```bash
cd backend

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt
pip install pytest
```

### 4. Configure Backend Environment Variables

In `backend/`, copy `.env.example` to create your local `.env`:

```bash
# Windows PowerShell
Copy-Item .env.example .env

# Linux / macOS
cp .env.example .env
```

Review `backend/.env` and verify your database connection credentials:

```dotenv
# Security (replace with a random 64-char hex string)
SECRET_KEY=your_generated_random_64_character_hex_key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# PostgreSQL Connection String
# Format: postgresql://<username>:<password>@localhost:5432/<dbname>
DATABASE_URL=postgresql://postgres:password@localhost:5432/smartaid

# Canonical Frontend Application URL
APP_BASE_URL=http://localhost:8080

# CORS Allowed Origins
ALLOWED_ORIGINS=http://localhost:8080,http://localhost:5173,http://localhost:3000,http://127.0.0.1:8080

# Hospital Geodata Provider Configuration
HOSPITAL_PROVIDER=nominatim
NOMINATIM_API_URL=https://nominatim.openstreetmap.org/search
NOMINATIM_USER_AGENT=SmartAidAcademicProject/1.0 (smartaid-project@college.edu)
HOSPITAL_TIMEOUT_SECONDS=10
ENABLE_LOCAL_OSM_FALLBACK=True
LOCAL_OSM_DATASET_PATH=app/data/osm_hospitals_reference.json
```

> **Security Note:** Never commit `.env` or hardcoded database passwords to version control. The `.gitignore` excludes all `.env` files automatically.

### 5. Apply Database Migrations with Alembic

From the `backend/` directory, apply all Alembic migrations to set up database tables, foreign keys, indexes, and initial seed data (including the permanent Walk-In QR code):

```bash
# Windows (PowerShell with activated venv)
python -m alembic upgrade head

# Linux / macOS
python -m alembic upgrade head
```

To verify the migration status:
```bash
python -m alembic current
```
You should see: `16e66c67e984 (head)`.

### 6. Start the FastAPI Backend Server

Run the backend with Uvicorn:

```bash
# From backend/ directory:
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

* **Interactive OpenAPI Swagger Docs:** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
* **ReDoc Documentation:** [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)
* **Liveness Probe:** [http://127.0.0.1:8000/health/live](http://127.0.0.1:8000/health/live)
* **Readiness & System Health Probe:** [http://127.0.0.1:8000/health/ready](http://127.0.0.1:8000/health/ready)

### 7. Install Frontend Dependencies and Start Frontend Server

Open a second terminal window, navigate to `frontend-new/`, install dependencies, and run the development server:

#### Windows (PowerShell):
```powershell
cd frontend-new

# Install dependencies using npm
npm.cmd install

# Start Vite development server
npm.cmd run dev
```

#### Linux / macOS:
```bash
cd frontend-new

# Install dependencies using npm
npm install

# Start Vite development server
npm run dev
```

The frontend will start at:
* **Web Application:** [http://localhost:8080](http://localhost:8080)

---

## Running Tests & Quality Checks

### Backend Test Suite (Pytest)
The test suite includes 180 comprehensive unit and integration tests covering triage severity classification, XGBoost pipeline, emergency overrides, first-aid instructions, QR sessions, admin auth, reports, feedback, and hospital routing.

```bash
# From project root:
backend\venv\Scripts\pytest backend\tests

# Or from backend/ directory:
cd backend
pytest tests
```

### Frontend TypeScript Check
Verify that all TypeScript types compile without errors:
```bash
cd frontend-new
npx.cmd tsc --noEmit     # Windows
npx tsc --noEmit         # Linux/macOS
```

### Frontend Linting
Run ESLint:
```bash
cd frontend-new
npm.cmd run lint         # Windows
npm run lint             # Linux/macOS
```

### Frontend Production Build
Compile static client assets and SSR server bundles:
```bash
cd frontend-new
npm.cmd run build        # Windows
npm run build            # Linux/macOS
```

---

## Project Structure

```
SmartAid/
├── backend/
│   ├── alembic/                 # Alembic migration scripts and environment
│   ├── alembic.ini              # Alembic database configuration
│   ├── app/
│   │   ├── api/v1/              # API router endpoints (auth, symptoms, triage, admin, etc.)
│   │   ├── core/                # Core settings, security (JWT), database session
│   │   ├── data/                # Reference datasets (OSM hospitals, first-aid rules)
│   │   ├── ml_models/           # Pre-trained XGBoost pipeline & label encoder artifacts
│   │   ├── models/              # SQLAlchemy database ORM models
│   │   ├── schemas/             # Pydantic v2 validation models
│   │   └── services/            # Severity engine, hospital locator, QR generator, triage
│   ├── requirements.txt         # Backend Python dependencies
│   ├── tests/                   # Pytest test suite (180 tests)
│   ├── .env.example             # Local environment configuration template
│   └── .env.production.example  # Production environment configuration template
├── frontend-new/
│   ├── src/
│   │   ├── components/          # Reusable UI components (buttons, dialogs, badges)
│   │   ├── lib/                 # Client utilities, API fetch helpers, auth state
│   │   └── routes/              # TanStack Start file-based routing
│   ├── package.json             # Frontend Node.js dependencies and scripts
│   ├── tsconfig.json            # TypeScript configuration
│   └── vite.config.ts           # Vite server, reverse proxy, and plugin configuration
├── docs/                        # Architecture and deployment documentation
└── README.md                    # Project documentation and local setup guide
```
