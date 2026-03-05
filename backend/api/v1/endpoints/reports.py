from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import text, and_, or_
from typing import List, Optional, Dict, Any
from decimal import Decimal
from datetime import datetime
from collections import defaultdict
from pydantic import BaseModel
from database.db import get_db
from database.tables.deals import Deal
from database.tables.users import User
from database.tables.accounts import Account
from database.tables.contacts import Contact
from database.tables.activity_log import ActivityLog
from database.tables.actuals import Actual
from database.tables.targets import Target
from api.v1.endpoints.auth import get_current_user
from services.access_scope_service import is_admin_user, is_sales_user

router = APIRouter()


def _enforce_sales_scope(
    current_user: User,
    salesperson: Optional[str],
    division: Optional[str],
    zone: Optional[str],
    cluster: Optional[str],
) -> tuple[Optional[str], Optional[str], Optional[str], Optional[str]]:
    if is_sales_user(current_user) and not is_admin_user(current_user):
        if salesperson and salesperson != current_user.ECode:
            raise HTTPException(status_code=403, detail="Sales user can only access own data")
        return current_user.ECode, None, None, None
    return salesperson, division, zone, cluster

# Response models for customer-wise endpoint
class KABCustomerData(BaseModel):
    Target: float
    Actuals: float

class NewBusinessData(BaseModel):
    Target: float
    Actuals: Dict[str, Dict[str, float]]  # Month -> Customer -> Actuals

class CustomerWiseResponse(BaseModel):
    KAB: Dict[str, Dict[str, KABCustomerData]]  # Month -> Customer -> Data
    EXISTING: Dict[str, Dict[str, float]]  # Month -> Customer -> Actuals
    NEW: NewBusinessData

def parse_financial_year(fy_string: str) -> tuple[datetime, datetime]:
    """
    Convert FY string (e.g., '24-25') to start and end datetime objects.
    Indian FY starts in April and ends in March.
    Returns (start_date, end_date) tuple.
    """
    try:
        start_year_raw, end_year_raw = fy_string.split('-')
        start_year_raw = start_year_raw.strip()
        end_year_raw = end_year_raw.strip()

        if len(start_year_raw) == 2:
            start_year = 2000 + int(start_year_raw)
        else:
            start_year = int(start_year_raw)

        if len(end_year_raw) == 2:
            end_year = 2000 + int(end_year_raw)
        else:
            end_year = int(end_year_raw)
        
        # FY starts in April of start_year and ends in March of end_year
        start_date = datetime(start_year, 4, 1)  # April 1st
        end_date = datetime(end_year, 3, 31, 23, 59, 59)  # March 31st end of day
        
        return start_date, end_date
    except (ValueError, AttributeError):
        raise HTTPException(
            status_code=400, 
            detail="Invalid FY format. Use format like '24-25' or '25-26'"
        )

@router.get("/sales-activity")
async def get_activity_report(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    fy: str = Query(..., description="Financial year (e.g., '24-25')"),
    division: Optional[str] = Query(None, description="Filter by division code"),
    zone: Optional[str] = Query(None, description="Filter by zone code"),
    cluster: Optional[str] = Query(None, description="Filter by cluster code"),
    salesperson: Optional[str] = Query(None),
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to")
):
    """
    Get activity report based on optional filters
    """
    salesperson, division, zone, cluster = _enforce_sales_scope(
        current_user, salesperson, division, zone, cluster
    )

    # Step 1: Get filtered user ECodes (Salespersons and KAMs)
    user_query = db.query(User.ECode)
    
    if division:
        user_query = user_query.filter(User.DOUCode == division)
    if zone:
        user_query = user_query.filter(User.ZOUCode == zone)
    if cluster:
        user_query = user_query.filter(User.COUCode == cluster)
    if salesperson:
        user_query = user_query.filter(User.ECode == salesperson)
    
    user_ecodes = [row.ECode for row in user_query.all()]
    
    if not user_ecodes:
        return {}
    
    # Step 2: Get valid Deal IDs where user is either:
    # - The Salesperson on the Deal
    # - The KAM stored in the Deal
    deal_query = db.query(Deal).filter(
        Deal.Status == "APPROVED",
        or_(
            Deal.SalespersonECode.in_(user_ecodes),
            Deal.KAMECode.in_(user_ecodes)
        )
    )
    
    deal_ids = [row.ID for row in deal_query.all()]
    
    if not deal_ids:
        return {}
    
    # Step 3: Get ActivityLog entries for those deals and date range
    activity_query = db.query(ActivityLog).filter(ActivityLog.DealID.in_(deal_ids))
    
    # Handle FY parameter first (takes precedence over individual date filters)
    fy_start, fy_end = parse_financial_year(fy)
    activity_query = activity_query.filter(
        ActivityLog.CreatedAt >= fy_start,
        ActivityLog.CreatedAt <= fy_end
    )
    
    # Apply additional date filters if provided (within the FY range)
    if from_date:
        try:
            from_datetime = datetime.fromisoformat(from_date.replace('Z', '+00:00'))
            # Ensure from_date is within FY range
            if from_datetime >= fy_start:
                activity_query = activity_query.filter(ActivityLog.CreatedAt >= from_datetime)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid from date format. Use ISO format (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS)")
    
    if to_date:
        try:
            to_datetime = datetime.fromisoformat(to_date.replace('Z', '+00:00'))
            # Ensure to_date is within FY range
            if to_datetime <= fy_end:
                activity_query = activity_query.filter(ActivityLog.CreatedAt <= to_datetime)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid to date format. Use ISO format (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS)")
    
    activity_logs = activity_query.all()

    deals_with_stage_from_new = {
        log.DealID
        for log in activity_logs
        if log.StageFrom and log.StageFrom.upper() == "NEW"
    }

     # Step 4: Find latest stage per deal
    latest_stage_per_deal = {}
    for log in activity_logs:
        if log.StageTo:
            current = latest_stage_per_deal.get(log.DealID)
            if not current or log.CreatedAt > current.CreatedAt:
                latest_stage_per_deal[log.DealID] = log

    month_labels = ["APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC", "JAN", "FEB", "MAR"]
    month_map = {i: month_labels[(i - 4) % 12] for i in range(1, 13)}  # 1 = Jan, 4 = Apr

    # Step 5: Aggregate by stage
    monthly_stage_counts = defaultdict(lambda: defaultdict(int))

    # Process latest stage per deal
    for log in latest_stage_per_deal.values():
        if not log.StageTo or not log.CreatedAt:
            continue
        month_num = log.CreatedAt.month
        month_label = month_map[month_num]
        stage = log.StageTo.upper()
        monthly_stage_counts[month_label][stage] += 1

    # CREATED counts
    created_logs = [log for log in activity_logs if log.Action.lower() == "created deal"]
    for log in created_logs:
        m = month_map[log.CreatedAt.month]
        monthly_stage_counts[m]["CREATED"] += 1

    # NEW counts = those created-deal logs whose DealID never had StageFrom="NEW"
    for log in created_logs:
        if log.DealID not in deals_with_stage_from_new:
            m = month_map[log.CreatedAt.month]
            monthly_stage_counts[m]["NEW"] += 1

    # Build final result
    result = { month: dict(counts) for month, counts in monthly_stage_counts.items() }
    return result


@router.get("/target-vs-actuals")
async def get_target_vs_actuals_report(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    fy: str = Query(..., description="Financial year (e.g., '24-25')"),
    division: Optional[str] = Query(None, description="Filter by division code"),
    zone: Optional[str] = Query(None, description="Filter by zone code"),
    cluster: Optional[str] = Query(None, description="Filter by cluster code"),
    salesperson: Optional[str] = Query(None, description="Filter by salesperson ECode")
):
    """
    Get target vs actuals report by month including previous year data
    """
    salesperson, division, zone, cluster = _enforce_sales_scope(
        current_user, salesperson, division, zone, cluster
    )

    # Calculate previous financial year
    try:
        start_year_short, end_year_short = fy.split('-')
        prev_start_year = str(int(start_year_short) - 1).zfill(2)
        prev_end_year = str(int(end_year_short) - 1).zfill(2)
        previous_fy = f"{prev_start_year}-{prev_end_year}"
    except (ValueError, AttributeError):
        raise HTTPException(status_code=400, detail="Invalid FY format for previous year calculation")
    
    # Build WHERE conditions for user filtering
    where_conditions = ["a.FY = :fy"]
    params = {"fy": fy}
    
    if division:
        where_conditions.append("u.DOUCode = :division")
        params["division"] = division
    if zone:
        where_conditions.append("u.ZOUCode = :zone")
        params["zone"] = zone
    if cluster:
        where_conditions.append("u.COUCode = :cluster")
        params["cluster"] = cluster
    if salesperson:
        where_conditions.append("u.ECode = :salesperson")
        params["salesperson"] = salesperson
    
    where_clause = " AND " + " AND ".join(where_conditions)
    
    # Query for current year actuals
    actuals_query = f"""
        SELECT a.Month, SUM(a.Actual) as total_actual
        FROM Actuals a, Users u 
        WHERE a.ECode = u.ECode{where_clause}
        GROUP BY a.Month
    """
    
    # Query for previous year actuals
    py_where_conditions = ["a.FY = :previous_fy"]
    py_params = {"previous_fy": previous_fy}
    
    if division:
        py_where_conditions.append("u.DOUCode = :division")
        py_params["division"] = division
    if zone:
        py_where_conditions.append("u.ZOUCode = :zone")
        py_params["zone"] = zone
    if cluster:
        py_where_conditions.append("u.COUCode = :cluster")
        py_params["cluster"] = cluster
    if salesperson:
        py_where_conditions.append("u.ECode = :salesperson")
        py_params["salesperson"] = salesperson
    
    py_where_clause = " AND " + " AND ".join(py_where_conditions)
    
    py_actuals_query = f"""
        SELECT a.Month, SUM(a.Actual) as total_actual
        FROM Actuals a, Users u 
        WHERE a.ECode = u.ECode{py_where_clause}
        GROUP BY a.Month
    """
    
    # Build WHERE conditions for targets
    target_where_conditions = ["t.FY = :fy"]
    target_params = {"fy": fy}
    
    if division:
        target_where_conditions.append("u.DOUCode = :division")
        target_params["division"] = division
    if zone:
        target_where_conditions.append("u.ZOUCode = :zone")
        target_params["zone"] = zone
    if cluster:
        target_where_conditions.append("u.COUCode = :cluster")
        target_params["cluster"] = cluster
    if salesperson:
        target_where_conditions.append("u.ECode = :salesperson")
        target_params["salesperson"] = salesperson
    
    target_where_clause = " AND " + " AND ".join(target_where_conditions)
    
    # Query for targets
    targets_query = f"""
        SELECT t.Month, SUM(t.Target) as total_target
        FROM Targets t, Users u 
        WHERE t.ECode = u.ECode{target_where_clause}
        GROUP BY t.Month
    """
    
    # Execute queries
    actuals_result = db.execute(text(actuals_query), params).fetchall()
    py_actuals_result = db.execute(text(py_actuals_query), py_params).fetchall()
    targets_result = db.execute(text(targets_query), target_params).fetchall()
    
    # Convert to dictionaries
    actuals_dict = {row.Month.upper(): float(row.total_actual) if row.total_actual else 0 for row in actuals_result}
    py_actuals_dict = {row.Month.upper(): float(row.total_actual) if row.total_actual else 0 for row in py_actuals_result}
    targets_dict = {row.Month.upper(): float(row.total_target) if row.total_target else 0 for row in targets_result}
    
    # Get all unique months and create the result
    all_months = set(actuals_dict.keys()) | set(targets_dict.keys()) | set(py_actuals_dict.keys())
    
    result = {}
    for month in all_months:
        result[month] = {
            "PY": py_actuals_dict.get(month, 0),
            "TARGET": targets_dict.get(month, 0),
            "ACTUALS": actuals_dict.get(month, 0)
        }
    
    return result


@router.get("/customer-wise", response_model=CustomerWiseResponse)
async def get_customer_wise_report(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    fy: str = Query(..., description="Financial year (e.g., '24-25')"),
    division: Optional[str] = Query(None, description="Filter by division code"),
    zone: Optional[str] = Query(None, description="Filter by zone code"),
    cluster: Optional[str] = Query(None, description="Filter by cluster code"),
    salesperson: Optional[str] = Query(None, description="Filter by salesperson ECode")
):
    """
    Get customer-wise target vs actuals report by month organized by account type:
    - KAB: Key Account Business with customer-wise targets and actuals
    - EXISTING: Existing customers with actuals only (no targets)
    - NEW: New business with combined targets and customer-wise actuals
    
    Returns data in format:
    {
        "KAB": {
            "APR": {
                "CUSTOMER_NAME": {"Target": 100, "Actuals": 80}
            }
        },
        "EXISTING": {
            "APR": {
                "CUSTOMER_NAME": 50
            }
        },
        "NEW": {
            "Target": 1000,
            "Actuals": {
                "APR": {
                    "CUSTOMER_NAME": 200
                }
            }
        }
    }
    """
    salesperson, division, zone, cluster = _enforce_sales_scope(
        current_user, salesperson, division, zone, cluster
    )

    # Build WHERE conditions for user filtering
    where_conditions = ["t.FY = :fy"]
    params = {"fy": fy}
    
    if division:
        where_conditions.append("u.DOUCode = :division")
        params["division"] = division
    if zone:
        where_conditions.append("u.ZOUCode = :zone")
        params["zone"] = zone
    if cluster:
        where_conditions.append("u.COUCode = :cluster")
        params["cluster"] = cluster
    if salesperson:
        where_conditions.append("u.ECode = :salesperson")
        params["salesperson"] = salesperson
    
    where_clause = " AND " + " AND ".join(where_conditions)
    
    # Helper function to create customer key
    def create_customer_key(name, division, location):
        parts = [name]
        if division:
            parts.append(division)
        if location:
            parts.append(location)
        return " - ".join(parts)
    
    # Query for KAB targets (AccountType = 'EXISTING' in targets for key accounts)
    kab_targets_query = f"""
        SELECT t.Month, a.Name, a.Division, a.Location, SUM(t.Target) as total_target
        FROM Targets t, Accounts a, Users u 
        WHERE t.AccountID = a.id AND t.ECode = u.ECode AND t.AccountType = 'EXISTING'{where_clause}
        GROUP BY t.Month, a.Name, a.Division, a.Location
    """
    
    # Query for NEW business targets (combined target)
    new_targets_query = f"""
        SELECT SUM(t.Target) as total_target
        FROM Targets t, Users u 
        WHERE t.ECode = u.ECode AND t.AccountType = 'NEW'{where_clause}
    """
    
    # Build WHERE conditions for actuals
    actuals_where_conditions = ["act.FY = :fy"]
    actuals_params = {"fy": fy}
    
    if division:
        actuals_where_conditions.append("u.DOUCode = :division")
        actuals_params["division"] = division
    if zone:
        actuals_where_conditions.append("u.ZOUCode = :zone")
        actuals_params["zone"] = zone
    if cluster:
        actuals_where_conditions.append("u.COUCode = :cluster")
        actuals_params["cluster"] = cluster
    if salesperson:
        actuals_where_conditions.append("u.ECode = :salesperson")
        actuals_params["salesperson"] = salesperson
    
    actuals_where_clause = " AND " + " AND ".join(actuals_where_conditions)
    
    # Query for all actuals (we'll categorize them based on whether account has KAB targets)
    actuals_query = f"""
        SELECT act.Month, a.Name, a.Division, a.Location, a.id as AccountID,
               SUM(act.Actual) as total_actual, act.AccountType
        FROM Actuals act, Accounts a, Users u 
        WHERE act.AccountID = a.id AND act.ECode = u.ECode{actuals_where_clause}
        GROUP BY act.Month, a.Name, a.Division, a.Location, a.id, act.AccountType
    """
    
    # Execute queries
    kab_targets_result = db.execute(text(kab_targets_query), params).fetchall()
    new_targets_result = db.execute(text(new_targets_query), params).fetchone()
    actuals_result = db.execute(text(actuals_query), actuals_params).fetchall()
    
    # Initialize result structure
    result = {
        "KAB": {},
        "EXISTING": {},
        "NEW": {
            "Target": float(new_targets_result.total_target) if new_targets_result and new_targets_result.total_target else 0,
            "Actuals": {}
        }
    }
    
    # Process KAB targets and track which accounts have KAB targets
    kab_data = defaultdict(dict)
    kab_account_ids = set()  # Track account IDs that have KAB targets
    kab_customer_keys = set()  # Track customer keys that have KAB targets
    
    for row in kab_targets_result:
        month = row.Month.upper()
        customer_key = create_customer_key(row.Name, row.Division, row.Location)
        
        if month not in kab_data:
            kab_data[month] = {}
        
        kab_data[month][customer_key] = {
            "Target": float(row.total_target) if row.total_target else 0,
            "Actuals": 0  # Will be filled from actuals
        }
        
        # Note: We can't get AccountID from targets query since it joins tables differently
        # We'll identify KAB accounts by customer name when processing actuals
        kab_customer_keys.add(customer_key)
    
    # Group actuals by customer and month, summing across all AccountTypes for KAB customers
    customer_actuals = defaultdict(lambda: defaultdict(float))  # customer_key -> month -> total_actuals
    non_kab_actuals = defaultdict(lambda: defaultdict(lambda: defaultdict(float)))  # account_type -> month -> customer -> actuals
    
    for row in actuals_result:
        month = row.Month.upper()
        customer_key = create_customer_key(row.Name, row.Division, row.Location)
        actual_value = float(row.total_actual) if row.total_actual else 0
        account_type = row.AccountType
        account_id = row.AccountID
        
        # Check if this customer has KAB targets (is a KAB account)
        if customer_key in kab_customer_keys:
            # This is a KAB account - sum all actuals regardless of AccountType
            customer_actuals[customer_key][month] += actual_value
        else:
            # This is not a KAB account - categorize by AccountType
            if account_type == "EXISTING":
                non_kab_actuals["EXISTING"][month][customer_key] += actual_value
            elif account_type == "NEW":
                non_kab_actuals["NEW"][month][customer_key] += actual_value
            # Skip KAB actuals for non-KAB accounts (shouldn't happen but just in case)
    
    # Fill KAB actuals from consolidated customer actuals
    for customer_key, months_data in customer_actuals.items():
        for month, total_actuals in months_data.items():
            if month not in kab_data:
                kab_data[month] = {}
            if customer_key not in kab_data[month]:
                # Account has actuals but no target - still show in KAB since it's a KAB account
                kab_data[month][customer_key] = {"Target": 0, "Actuals": 0}
            kab_data[month][customer_key]["Actuals"] = total_actuals

    # Add non-KAB actuals to their respective sections
    for month, customers in non_kab_actuals["EXISTING"].items():
        if month not in result["EXISTING"]:
            result["EXISTING"][month] = {}
        for customer_key, actuals in customers.items():
            result["EXISTING"][month][customer_key] = actuals
    
    for month, customers in non_kab_actuals["NEW"].items():
        if month not in result["NEW"]["Actuals"]:
            result["NEW"]["Actuals"][month] = {}
        for customer_key, actuals in customers.items():
            result["NEW"]["Actuals"][month][customer_key] = actuals
    
    # Convert KAB data to result format
    result["KAB"] = dict(kab_data)
    
    return result
