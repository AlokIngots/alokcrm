from __future__ import annotations

from datetime import datetime
from typing import Optional


ADMIN_ROLES = {"MD Office", "Finance", "Admin", "Super Admin", "admin"}
SALES_ROLES = {"Sales", "Salesperson", "sales"}
SALES_COORDINATOR_ROLES = {"Manager", "Sales Coordinator", "sales_coordinator"}

LOCAL_DIVISION_ALIASES = ["TPT", "LOCAL", "DOU01"]
EXPORT_DIVISION_ALIASES = ["SCM", "XPR", "EXPORT", "EXPORTS"]

DEAL_STAGE_WON = "DEAL_WON"
DEAL_STAGE_LOST = "DEAL_LOST"
DEAL_STAGE_OFFER = "OFFER_SUBMITTED"

V2_PIPELINE_STAGE_MAP = {
    "NEW": "ENQUIRY",
    "ENQUIRY": "ENQUIRY",
    "FEASIBILITY": "FEASIBILITY",
    "OFFER_SUBMITTED": "OFFER",
    "OFFER": "OFFER",
    "DEAL_WON": "ORDER_WON",
    "ORDER_WON": "ORDER_WON",
    "DEAL_LOST": "ORDER_LOST",
    "ORDER_LOST": "ORDER_LOST",
}

ENQUIRY_STATUS_BY_STAGE = {
    "NEW": "NEW",
    "ENQUIRY": "NEW",
    "FEASIBILITY": "REVIEWED",
    "OFFER_SUBMITTED": "QUOTED",
    "OFFER": "QUOTED",
    "DEAL_WON": "WON",
    "ORDER_WON": "WON",
    "DEAL_LOST": "LOST",
    "ORDER_LOST": "LOST",
}


def normalize_division_label(value: Optional[str]) -> Optional[str]:
    raw = (value or "").strip().upper()
    if raw in LOCAL_DIVISION_ALIASES:
        return "Local"
    if raw in EXPORT_DIVISION_ALIASES:
        return "Export"
    if raw.startswith("DOU"):
        return "Local" if raw == "DOU01" else "Export"
    return None


def division_aliases(value: Optional[str]) -> list[str]:
    label = normalize_division_label(value)
    if label == "Local":
        return LOCAL_DIVISION_ALIASES[:]
    if label == "Export":
        return EXPORT_DIVISION_ALIASES[:]

    raw = (value or "").strip().upper()
    return [raw] if raw else []


def canonical_division_code(value: Optional[str]) -> Optional[str]:
    label = normalize_division_label(value)
    if label == "Local":
        return "TPT"
    if label == "Export":
        return "SCM"
    return None


def normalize_sale_type(value: Optional[str]) -> str:
    return "EXPORT" if normalize_division_label(value) == "Export" else "LOCAL"


def normalize_v2_stage(value: Optional[str]) -> str:
    return V2_PIPELINE_STAGE_MAP.get((value or "").strip().upper(), "ENQUIRY")


def map_deal_stage_to_enquiry_status(value: Optional[str]) -> str:
    return ENQUIRY_STATUS_BY_STAGE.get((value or "").strip().upper(), "NEW")


def parse_financial_year(fy_string: str) -> tuple[datetime, datetime]:
    start_year_raw, end_year_raw = fy_string.split("-")
    start_year_raw = start_year_raw.strip()
    end_year_raw = end_year_raw.strip()

    start_year = 2000 + int(start_year_raw) if len(start_year_raw) == 2 else int(start_year_raw)
    end_year = 2000 + int(end_year_raw) if len(end_year_raw) == 2 else int(end_year_raw)

    return datetime(start_year, 4, 1), datetime(end_year, 3, 31, 23, 59, 59)
