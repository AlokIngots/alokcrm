from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
from typing import Optional, List, Dict, Any
from collections import defaultdict
from database.db import get_db
from database.tables.deals import Deal
from database.tables.users import User
from database.tables.accounts import Account
from database.tables.actuals import Actual
from database.tables.activity_log import ActivityLog
from api.v1.endpoints.auth import get_current_user
from services.access_scope_service import is_admin_user, is_sales_user
from services.business_rules import DEAL_STAGE_WON, division_aliases, normalize_division_label, parse_financial_year

router = APIRouter()

@router.get("/")
async def get_leaderboard(
    division: str = Query(..., description="Division filter - Local or Export"),
    fy: str = Query(..., description="Financial year (e.g., '24-25')"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get leaderboard for a specific division and financial year based on sum of Actual sales.
    
    Returns leaderboard sorted by total sales (sum of Actual column) in descending order.
    Only includes data from the specified financial year.
    """
    
    # Validate division parameter
    division_label = normalize_division_label(division)
    division_codes = division_aliases(division)
    if not division_label:
        raise HTTPException(status_code=400, detail="Division must be Local or Export")
    
    # Parse financial year to get date range
    try:
        fy_start, fy_end = parse_financial_year(fy)
    except (ValueError, AttributeError):
        raise HTTPException(
            status_code=400,
            detail="Invalid FY format. Use format like '24-25' or '25-26'",
        )
    
    # Get unique ECodes (both salesperson and KAM) from deals in the specified division
    salesperson_ecodes = db.query(Deal.SalespersonECode).filter(
        Deal.Division.in_(division_codes),
        Deal.SalespersonECode.isnot(None)
    ).distinct().all()
    
    kam_ecodes = db.query(Deal.KAMECode).filter(
        Deal.Division.in_(division_codes),
        Deal.KAMECode.isnot(None)
    ).distinct().all()
    
    # Combine and deduplicate ECodes
    division_ecodes = set()
    division_ecodes.update([user.SalespersonECode for user in salesperson_ecodes])
    division_ecodes.update([user.KAMECode for user in kam_ecodes])
    division_ecodes = list(division_ecodes)
    
    if not division_ecodes:
        return []
    
    # Get sum of Actual sales grouped by ECode for users in the division and FY
    # Only consider new business (exclude KAB AccountType)
    actuals_query = db.query(
        Actual.ECode,
        func.sum(Actual.Actual).label('total_sales')
    ).filter(
        Actual.ECode.in_(division_ecodes),
        Actual.FY == fy,
        Actual.Actual.isnot(None),
        Actual.AccountType != 'KAB'
    ).group_by(Actual.ECode)
    
    actuals_results = actuals_query.all()
    
    if not actuals_results:
        return []
    
    # Get deals that were won in the financial year by checking activity logs
    won_deals_query = db.query(ActivityLog.DealID).filter(
        ActivityLog.StageTo == DEAL_STAGE_WON,
        ActivityLog.CreatedAt >= fy_start,
        ActivityLog.CreatedAt <= fy_end
    ).distinct()
    
    won_deal_ids = [log.DealID for log in won_deals_query.all()]
    
    # Build leaderboard data
    leaderboard_list = []
    
    for ecode, total_sales in actuals_results:
        # Get user name
        user = db.query(User).filter(User.ECode == ecode).first()
        user_name = user.Name if user else "Unknown"
        
        # Count deals won in the FY for this user in the specified division
        deals_won_count = 0
        if won_deal_ids:
            deals_won_count = db.query(Deal).filter(
                Deal.ID.in_(won_deal_ids),
                Deal.Division.in_(division_codes),
                or_(
                    Deal.SalespersonECode == ecode,
                    Deal.KAMECode == ecode
                )
            ).count()
        
        leaderboard_list.append({
            "ECode": ecode,
            "name": user_name,
            "deals_won": deals_won_count,
            "sales": float(total_sales) if total_sales else 0.0
        })
    
    # Sales users can only view their own leaderboard row.
    if is_sales_user(current_user) and not is_admin_user(current_user):
        leaderboard_list = [row for row in leaderboard_list if row["ECode"] == current_user.ECode]

    # Sort by sales descending
    leaderboard_list.sort(key=lambda x: x["sales"], reverse=True)
    
    return leaderboard_list 
