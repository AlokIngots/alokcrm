# Backend (FastAPI + SQLite)

## Run

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python main.py
```

API URL: `http://127.0.0.1:8000`

## Environment

Set `.env` in `backend/`:

```env
DATABASE_URL=sqlite:///./database.db
JWT_SECRET_KEY=change_this_for_prod
SMS_MODE=mock
CORS_ORIGINS=http://localhost:3000
LOG_LEVEL=INFO
```

PostgreSQL for production:

```env
DATABASE_URL=postgresql+psycopg2://crm_user:crm_pass@db-host:5432/crm
```

Also review `../PRODUCTION_CHECKLIST.md` before go-live.

## Main Entry

- `main.py`
- Routers in `api/v1/endpoints/`
- DB models in `database/tables/`

## Current Database

Core CRM tables:
- `Users`, `Accounts`, `Contacts`
- `Deals`, `DealStatus`, `ActivityLog`, `Notes`
- `Enquiries`, `EnquiryItems`
- `Targets`, `Actuals`, `RolePermissions`, `BlacklistReason`

Material master tables:
- `GradeCatalog` (loaded from `GRADE MASTER.xlsx`)
- `ToleranceChartRows` (ISO class/diameter tolerance rows)

## Important Endpoint Groups

- Auth: `/api/v1/auth/*`
- Accounts: `/api/v1/accounts/*`
- Contacts: `/api/v1/contacts/*`
- Deals/Pipeline: `/api/v1/deals/*`
- Enquiries: `/api/v1/enquiries/*`
- Material masters: `/api/v1/material-masters/*`

## New Material Master Endpoints

- `GET /api/v1/material-masters/grades`
- `POST /api/v1/material-masters/grades/import`
- `GET /api/v1/material-masters/tolerances`
- `POST /api/v1/material-masters/tolerances/seed-default`

## Enquiry Master Endpoints (for frontend dropdowns)

- `GET /api/v1/enquiries/masters/grades`
- `GET /api/v1/enquiries/masters/tolerances`

## Validation Added

Enquiry item create/update now validates:
- `Grade` against `GradeCatalog`
- `Tolerance` against `ToleranceChartRows` class codes (`h9`, `f7`, `k10`, etc.)

## Quick Checks

```bash
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:8000/health/live
curl http://127.0.0.1:8000/health/ready
curl http://127.0.0.1:8000/api/v1/enquiries/masters/grades
curl http://127.0.0.1:8000/api/v1/enquiries/masters/tolerances
```

## Data Safety and Migration

Run from repository root:

```bash
./scripts/backup_db.sh
./scripts/restore_db.sh <backup_path>
```

SQLite to PostgreSQL migration:

```bash
python3 scripts/migrate_sqlite_to_postgres.py \
  --sqlite-url sqlite:///./backend/database.db \
  --postgres-url postgresql+psycopg2://crm_user:crm_pass@localhost:5432/crm \
  --truncate
```
