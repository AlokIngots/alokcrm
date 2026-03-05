from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import json
import logging
import os
import time
from datetime import datetime, timezone
from uuid import uuid4
import uvicorn
from sqlalchemy import text

from api.v1.endpoints import (
    users,
    accounts,
    contacts,
    deals,
    auth,
    deal_status,
    inbox,
    activity_log,
    reports,
    dashboard,
    leaderboard,
    targets,
    actuals,
    enquiries,
    products,
    material_masters,
)
from database.db import engine
from database.tables.users import User
from database.tables.contacts import Contact
from database.tables.deals import Deal
from database.tables.deal_status import DealStatus
from database.db import Base

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Alok CRM API",
    description="A FastAPI backend for Alok CRM system",
    version="1.0.0",
)

def _parse_cors_origins() -> list[str]:
    raw = os.getenv("CORS_ORIGINS", "").strip()
    if not raw:
        # Safe defaults for local development only.
        return ["http://localhost:3000", "http://127.0.0.1:3000"]
    if raw == "*":
        # Keep explicit wildcard support when intentionally configured.
        return ["*"]
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


def _configure_logging() -> None:
    level_name = os.getenv("LOG_LEVEL", "INFO").upper()
    level = getattr(logging, level_name, logging.INFO)
    logging.basicConfig(level=level, format="%(message)s")


_configure_logging()
logger = logging.getLogger("crm.api")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=_parse_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def request_log_middleware(request: Request, call_next):
    start = time.perf_counter()
    request_id = request.headers.get("x-request-id", str(uuid4()))
    response = await call_next(request)
    duration_ms = round((time.perf_counter() - start) * 1000, 2)
    response.headers["x-request-id"] = request_id
    logger.info(
        json.dumps(
            {
                "event": "http_request",
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "duration_ms": duration_ms,
                "client_ip": request.client.host if request.client else None,
            }
        )
    )
    return response

# Include routers
app.include_router(users.router, prefix="/api/v1/users", tags=["users"])
app.include_router(accounts.router, prefix="/api/v1/accounts", tags=["companies"])
app.include_router(contacts.router, prefix="/api/v1/contacts", tags=["contacts"])
app.include_router(deals.router, prefix="/api/v1/deals", tags=["deals"])
app.include_router(deal_status.router, prefix="/api/v1/deal-status", tags=["deal-status"])
app.include_router(inbox.router, prefix="/api/v1/inbox", tags=["inbox"])
app.include_router(auth.router, prefix="/api/v1/auth", tags=["authentication"])
app.include_router(activity_log.router, prefix="/api/v1/activity-log", tags=["activity-log"])
app.include_router(reports.router, prefix="/api/v1/reports", tags=["reports"])
app.include_router(dashboard.router, prefix="/api/v1/dashboard", tags=["dashboard"])
app.include_router(leaderboard.router, prefix="/api/v1/leaderboard", tags=["leaderboard"])
app.include_router(targets.router, prefix="/api/v1/targets", tags=["targets"])
app.include_router(actuals.router, prefix="/api/v1/actuals", tags=["actuals"])
app.include_router(enquiries.router, prefix="/api/v1/enquiries", tags=["enquiries"])
app.include_router(products.router, prefix="/api/v1/products", tags=["products"])
app.include_router(material_masters.router, prefix="/api/v1/material-masters", tags=["material-masters"])

@app.get("/")
async def root():
    
    return {"message": "Welcome to Alok CRM API"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}


@app.get("/health/live")
async def live_check():
    return {"status": "alive"}


@app.get("/health/ready")
async def readiness_check():
    start = time.perf_counter()
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        duration_ms = round((time.perf_counter() - start) * 1000, 2)
        return {
            "status": "ready",
            "database": "ok",
            "checked_at": datetime.now(timezone.utc).isoformat(),
            "duration_ms": duration_ms,
        }
    except Exception as exc:  # pragma: no cover - runtime safety endpoint
        logger.exception("Readiness check failed")
        return JSONResponse(
            status_code=503,
            content={
                "status": "not_ready",
                "database": "error",
                "error": str(exc),
                "checked_at": datetime.now(timezone.utc).isoformat(),
            },
        )

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
