# ⚡ FlowForge — Configurable ETL Pipeline Engineering Platform

FlowForge is a robust, configurable **data engineering and ETL pipeline platform** built for transforming, validating, and persisting tabular datasets through an interactive visual workbench.

The platform combines **React, JSX, CSS, FastAPI, Python, Pandas, and PostgreSQL** to provide a local-first, production-grade pipeline engineering environment.

---

## 🎯 Architecture & Workflow

```text
                     ┌───────────────────────┐
                     │    Raw CSV Dataset    │
                     └──────────┬────────────┘
                                │
                                ▼
                     ┌───────────────────────┐
                     │  Pipeline Workbench   │
                     │  • Order of Steps     │
                     │  • Error Policy       │
                     │  • Target Destination │
                     └──────────┬────────────┘
                                │
                                ▼
            ┌─────────────────────────────────────────┐
            │         Transformation Library          │
            │  • Select, Rename, Drop, Reorder Cols   │
            │  • Type-Aware Filtering & Sorting       │
            │  • Deduplication with Retention Policy  │
            │  • Type Conversion (Fail / Null / Skip) │
            │  • Safe Derived Columns (No eval)       │
            │  • Group-By Aggregations (Sum, Avg, etc)│
            └───────────────────┬─────────────────────┘
                                │
                                ▼
            ┌─────────────────────────────────────────┐
            │        Intermediate Data Preview        │
            │  • Step-by-step sample row inspection   │
            │  • Inferred schema changes & diffs      │
            └───────────────────┬─────────────────────┘
                                │
                                ▼
            ┌─────────────────────────────────────────┐
            │        Pipeline Execution Engine        │
            │  • Sequential execution lifecycle       │
            │  • Duration, row counts & step metrics  │
            └───────────────────┬─────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
            ┌──────────────┐        ┌──────────────┐
            │ Cleaned CSV  │        │  PostgreSQL  │
            │ Stream/Export│        │ Destination  │
            └──────────────┘        └──────────────┘
```

---

## 🛠️ Technology Stack

- **Frontend:** React 19, Lucide React Icons, Recharts, Vite, Vanilla CSS.
- **Backend:** FastAPI, Python 3.11+, Pandas, Uvicorn.
- **Database:** PostgreSQL (with `psycopg2-binary`).
- **Data Engine:** Deterministic Pandas processing with safe parameterization (no `eval()` or unvalidated SQL execution).

---

## ✨ Platform Features

1. **Pipeline Designer (Workbench):**
   - Create, configure, reorder, duplicate, preview, validate, and execute multi-step ETL workflows.
   - Configure error policies (`stop_on_error`, `continue_on_warning`).
2. **Comprehensive Transformation Library:**
   - **Column Operations:** Multi-select columns, rename, drop, and custom reordering.
   - **Row Operations:** Type-aware filtering (`=`, `!=`, `>`, `<`, `contains`, `is_null`, `is_not_null`), multi-column sorting, and deduplication.
   - **Type Casting:** String, integer, decimal, date, boolean conversions with explicit error handling (`fail`, `set_null`, `reject_row`).
   - **Derived Columns:** Safe mathematical and string operations with zero arbitrary code execution.
   - **Aggregations:** Group-by aggregations (`sum`, `mean`, `count`, `min`, `max`).
3. **Intermediate Data Previews:**
   - Real-time step previews showing before/after sample data, row count variances, and schema changes.
4. **Execution Engine & Telemetry:**
   - Sequential step execution recording step durations, rows processed, warnings, and errors.
5. **PostgreSQL Relational Integration:**
   - Browse tables, preview live records, test connections, and write output with configurable append or replace modes.
6. **Data Contracts & Schema Drift Detection:**
   - Pre-execution validation enforcing column existence, data types, null constraints, min/max ranges, and permitted values.
7. **Run History & Execution Replay:**
   - Audit trail of previous runs with execution details and one-click replay.
8. **Reports:**
   - Export structured JSON and CSV execution audit reports.

---

## 🚀 Local Development Setup

### 1. Prerequisites
- **Python 3.11+** installed
- **Node.js (v20+)** & **npm** installed
- **PostgreSQL 14+** running locally on port 5432

### 2. Configure Backend Environment
Create a `.env` file in the root directory (or copy from `.env.example`):

```env
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=flowforge
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_postgres_password
```

### 3. Install Backend Dependencies & Start FastAPI
```powershell
# From project root
pip install -r requirements.txt

# Start FastAPI server
uvicorn backend.main:app --reload --port 8000
```
FastAPI interactive Swagger documentation will be available at: `http://localhost:8000/docs`.

### 4. Configure Frontend Environment & Start React
Create a `.env` file in the `frontend/` directory (or copy from `frontend/.env.example`):

```env
VITE_API_URL=http://localhost:8000
```

Start the Vite development server:
```powershell
cd frontend
npm install
npm run dev
```
The React application will be available at: `http://localhost:5173`.

---

## 🗄️ PostgreSQL Database Schema

FlowForge automatically creates and manages the following tables on startup:

- `customers`: Relational destination table for cleaned customer datasets.
- `pipelines`: Persists pipeline workflow definitions, ordered steps, and error policies.
- `pipeline_versions`: Stores version snapshots of saved pipelines.
- `pipeline_runs`: Execution records containing status, durations, row counts, and errors.
- `pipeline_step_runs`: Detailed per-step execution telemetry and row deltas.
- `data_contracts`: Schema validation contract rules.

---

## 📂 Repository

- **GitHub:** https://github.com/JoshuaDaniel06/FlowForge.git