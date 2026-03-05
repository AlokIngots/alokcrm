from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, text
from typing import Optional
from decimal import Decimal
from datetime import datetime
from collections import defaultdict
from database.db import get_db
from database.tables.deals import Deal
from database.tables.users import User
from database.tables.accounts import Account
from database.tables.activity_log import ActivityLog
from database.tables.actuals import Actual
from database.tables.targets import Target
from api.v1.endpoints.auth import get_current_user
from services.access_scope_service import is_admin_user, is_sales_user
from services.business_rules import DEAL_STAGE_LOST, DEAL_STAGE_WON, division_aliases, parse_financial_year

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


def _resolve_division_filters(division: Optional[str]) -> tuple[Optional[list[str]], Optional[list[str]]]:
    """
    Normalize division value from UI/filter options into:
    - user DOUCode aliases
    - deal division aliases
    """
    if not division:
        return None, None

    aliases = division_aliases(division)
    if not aliases:
        return None, None
    return aliases, aliases



@router.get("/")
async def get_dashboard_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    fy: str = Query(..., description="Financial year (e.g., '24-25')"),
    division: Optional[str] = Query(None, description="Filter by division code"),
    zone: Optional[str] = Query(None, description="Filter by zone code"),
    cluster: Optional[str] = Query(None, description="Filter by cluster code"),
    salesperson: Optional[str] = Query(None)
):
    """
    Get dashboard summary statistics:
    - Stages: counts, values, and average times
    - Performance: deals won/lost, targets vs actuals
    """
    salesperson, division, zone, cluster = _enforce_sales_scope(
        current_user, salesperson, division, zone, cluster
    )

    # Step 1: Get filtered user ECodes (same logic as reports endpoint)
    user_division_codes, deal_division_codes = _resolve_division_filters(division)
    user_query = db.query(User.ECode)
     
    if user_division_codes:
        user_query = user_query.filter(User.DOUCode.in_(user_division_codes))
    if zone:
        user_query = user_query.filter(User.ZOUCode == zone)
    if cluster:
        user_query = user_query.filter(User.COUCode == cluster)
    if salesperson:
        user_query = user_query.filter(User.ECode == salesperson)
    
    user_ecodes = [row.ECode for row in user_query.all()]
    
    # Step 2: Get deals created within the specified FY by checking activity logs
    try:
        fy_start, fy_end = parse_financial_year(fy)
    except (ValueError, AttributeError):
        raise HTTPException(
            status_code=400,
            detail="Invalid FY format. Use format like '24-25' or '25-26'",
        )

    base_deals_query = db.query(Deal).filter(Deal.Status == "APPROVED")
    if deal_division_codes:
        base_deals_query = base_deals_query.filter(Deal.Division.in_(deal_division_codes))
    if user_ecodes:
        base_deals_query = base_deals_query.filter(
            or_(
                Deal.SalespersonECode.in_(user_ecodes),
                Deal.KAMECode.in_(user_ecodes)
            )
        )
    elif salesperson:
        base_deals_query = base_deals_query.filter(
            or_(Deal.SalespersonECode == salesperson, Deal.KAMECode == salesperson)
        )

    # Find all "created deal" activity logs within the FY date range
    created_deal_logs = db.query(ActivityLog).filter(
        ActivityLog.Action.ilike("created deal"),
        ActivityLog.CreatedAt >= fy_start,
        ActivityLog.CreatedAt <= fy_end
    ).all()
    
    # Get deal IDs from these activity logs
    fy_deal_ids = [log.DealID for log in created_deal_logs if log.DealID]
    
    # Get approved deals that were created in this FY and match user criteria
    if fy_deal_ids:
        deals = base_deals_query.filter(Deal.ID.in_(fy_deal_ids)).all()
    else:
        # Fallback for legacy/seed data that may miss "created deal" activity logs.
        deals = base_deals_query.all()
    
    # Step 3: Calculate stage counts and values for approved deals
    stage_counts = defaultdict(int)
    stage_values = defaultdict(float)
    
    for deal in deals:
        if deal.Stage:
            stage = deal.Stage.upper()
            stage_counts[stage] += 1
            if deal.DealValue:
                stage_values[stage] += float(deal.DealValue)
    
    # Step 4: Calculate average time in each stage using activity logs
    if deals:
        deal_ids = [deal.ID for deal in deals]
        
        # Get all activity logs for these deals within the specified FY
        all_activity_logs = db.query(ActivityLog).filter(
            ActivityLog.DealID.in_(deal_ids),
            ActivityLog.CreatedAt >= fy_start,
            ActivityLog.CreatedAt <= fy_end
        ).order_by(ActivityLog.DealID, ActivityLog.CreatedAt).all()
        
        # Group activity logs by deal ID
        deal_activities = defaultdict(list)
        for log in all_activity_logs:
            deal_activities[log.DealID].append(log)
        
        # Calculate time spent in each stage
        stage_times = defaultdict(list)  # stage -> list of time durations
        
        for deal_id, activities in deal_activities.items():
            if not activities:
                continue
                
            # Sort by creation time to ensure proper order
            activities.sort(key=lambda x: x.CreatedAt)
            
            # Find "created deal" action (starting point)
            created_deal_log = None
            stage_change_logs = []
            
            for log in activities:
                if log.Action and log.Action.lower() == "created deal":
                    created_deal_log = log
                elif log.StageFrom and log.StageTo:
                    stage_change_logs.append(log)
            
            if not created_deal_log:
                continue  # Skip deals without creation log
            
            # Sort stage change logs by time
            stage_change_logs.sort(key=lambda x: x.CreatedAt)
            
            if not stage_change_logs:
                # Deal is still in NEW stage (no stage changes yet)
                new_stage_time = (datetime.now() - created_deal_log.CreatedAt).total_seconds()
                if new_stage_time > 0:
                    stage_times["NEW"].append(new_stage_time)
                continue
            
            # Calculate time for NEW stage: from deal creation to first stage change
            first_stage_change = stage_change_logs[0]
            if first_stage_change.StageFrom and first_stage_change.StageFrom.upper() == "NEW":
                new_stage_time = (first_stage_change.CreatedAt - created_deal_log.CreatedAt).total_seconds()
                if new_stage_time > 0:
                    stage_times["NEW"].append(new_stage_time)
            
            # Calculate time for other stages
            # For each stage change, calculate time spent in the StageFrom
            for i in range(len(stage_change_logs)):
                current_log = stage_change_logs[i]
                stage_from = current_log.StageFrom.upper() if current_log.StageFrom else None
                
                if not stage_from or stage_from in ["NEW", DEAL_STAGE_WON, DEAL_STAGE_LOST]:
                    continue  # Skip NEW (already calculated) and terminal states
                
                # Find when this stage was entered
                # It was entered when the previous log had StageTo = stage_from
                stage_entry_time = None
                
                # Look for the log that moved TO this stage
                for j in range(i):  # Look at all previous logs
                    prev_log = stage_change_logs[j]
                    if prev_log.StageTo and prev_log.StageTo.upper() == stage_from:
                        stage_entry_time = prev_log.CreatedAt
                        break
                
                if stage_entry_time:
                    # Calculate time from when stage was entered to when it was left
                    stage_exit_time = current_log.CreatedAt
                    time_in_stage = (stage_exit_time - stage_entry_time).total_seconds()
                    
                    if time_in_stage > 0:
                        stage_times[stage_from].append(time_in_stage)
            
            # Handle the current stage (last StageTo that's not terminal)
            if stage_change_logs:
                last_log = stage_change_logs[-1]
                current_stage = last_log.StageTo.upper() if last_log.StageTo else None
                
                if current_stage and current_stage not in [DEAL_STAGE_WON, DEAL_STAGE_LOST]:
                    # Calculate time from when current stage was entered to now
                    stage_entry_time = last_log.CreatedAt
                    current_time = datetime.now()
                    time_in_current_stage = (current_time - stage_entry_time).total_seconds()
                    
                    if time_in_current_stage > 0:
                        stage_times[current_stage].append(time_in_current_stage)
        
        # Calculate average time for each stage (convert seconds to days for readability)
        # Exclude sink states from average calculations
        average_stage_times = {}
        for stage, times in stage_times.items():
            if times and stage not in [DEAL_STAGE_WON, DEAL_STAGE_LOST]:
                average_seconds = sum(times) / len(times)
                average_days = round(average_seconds / (24 * 60 * 60), 2)  # Convert to days
                average_stage_times[stage] = average_days 
    else:
        average_stage_times = {}
    
    # Step 5: Calculate performance metrics
    
    # Get deals won and lost (filter by FY using activity logs)
    if fy_deal_ids:
        deals_won = db.query(Deal).filter(
            Deal.Stage == DEAL_STAGE_WON,
            Deal.ID.in_(fy_deal_ids),
            or_(
                Deal.SalespersonECode.in_(user_ecodes),
                Deal.KAMECode.in_(user_ecodes)
            )
        ).count()
        
        deals_lost = db.query(Deal).filter(
            Deal.Stage == DEAL_STAGE_LOST,
            Deal.ID.in_(fy_deal_ids),
            or_(
                Deal.SalespersonECode.in_(user_ecodes),
                Deal.KAMECode.in_(user_ecodes)
            )
        ).count()
    else:
        deals_won = 0
        deals_lost = 0
    
    # Get current month name in the format stored in DB
    current_date = datetime.now()
    current_month = current_date.month
    month_names = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", 
                   "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
    current_month_name = month_names[current_month - 1]
    
    # Build WHERE conditions for user filtering (same as target-vs-actuals)
    where_conditions = []
    params = {"fy": fy, "current_month": current_month_name}
    
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
    
    where_clause = " AND " + " AND ".join(where_conditions) if where_conditions else ""
    
    # Get year target
    year_target_query = f"""
        SELECT SUM(t.Target) as total_target
        FROM Targets t, Users u 
        WHERE t.ECode = u.ECode AND t.FY = :fy{where_clause}
    """
    year_target_result = db.execute(text(year_target_query), params).fetchone()
    year_target = float(year_target_result.total_target) if year_target_result.total_target else 0
    
    # Get YTD actuals
    ytd_actuals_query = f"""
        SELECT SUM(a.Actual) as total_actual
        FROM Actuals a, Users u 
        WHERE a.ECode = u.ECode AND a.FY = :fy{where_clause}
    """
    ytd_actuals_result = db.execute(text(ytd_actuals_query), params).fetchone()
    ytd_actuals = float(ytd_actuals_result.total_actual) if ytd_actuals_result.total_actual else 0
    
    # Get month target
    month_target_query = f"""
        SELECT SUM(t.Target) as total_target
        FROM Targets t, Users u 
        WHERE t.ECode = u.ECode AND t.FY = :fy AND t.Month = :current_month{where_clause}
    """
    month_target_result = db.execute(text(month_target_query), params).fetchone()
    month_target = float(month_target_result.total_target) if month_target_result.total_target else 0
    
    # Get month actuals
    month_actuals_query = f"""
        SELECT SUM(a.Actual) as total_actual
        FROM Actuals a, Users u
        WHERE a.ECode = u.ECode AND a.FY = :fy AND a.Month = :current_month{where_clause}
    """
    month_actuals_result = db.execute(text(month_actuals_query), params).fetchone()
    month_actuals = float(month_actuals_result.total_actual) if month_actuals_result.total_actual else 0

    return {
        "stages": {
            "stage_counts": dict(stage_counts),
            "stage_values": dict(stage_values),
            "average_stage_times": average_stage_times
        },
        "performance": {
            "deals_won": deals_won,
            "deals_lost": deals_lost,
            "year_target": year_target,
            "ytd_actuals": ytd_actuals,
            "month_target": month_target,
            "month_actuals": month_actuals
        }
    } 
