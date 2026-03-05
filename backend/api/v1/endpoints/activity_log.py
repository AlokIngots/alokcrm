from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from datetime import datetime, timedelta

from database.db import get_db
from database.tables.activity_log import ActivityLog, ActivityLogCreate, ActivityLogResponse
from database.tables.users import User
from database.tables.deals import Deal
from api.v1.endpoints.auth import get_current_user

from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

router = APIRouter()

# new Pydantic response model
class ActivityLogSummary(BaseModel):
    user: str
    account: str
    division: Optional[str]
    service_type: Optional[str]
    deal_value: Optional[float]
    timestamp: datetime
    action: str

@router.get("/", response_model=List[ActivityLogResponse])
async def get_activity_logs(
    deal_id: Optional[int] = Query(None, description="Filter logs by deal ID"),
    user_ecode: Optional[str] = Query(None, description="Filter logs by user ECode"),
    days: Optional[int] = Query(None, description="Filter logs by last N days"),
    stage_changes_only: Optional[bool] = Query(False, description="Filter to show only stage change logs"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get activity logs with optional filters
    """
    query = db.query(ActivityLog).options(
        joinedload(ActivityLog.user),
        joinedload(ActivityLog.deal)
    )
    
    # Apply filters
    if deal_id:
        query = query.filter(ActivityLog.DealID == deal_id)
    if user_ecode:
        query = query.filter(ActivityLog.ECode == user_ecode)
    if days:
        cutoff_date = datetime.now() - timedelta(days=days)
        query = query.filter(ActivityLog.CreatedAt >= cutoff_date)
    if stage_changes_only:
        query = query.filter(ActivityLog.StageFrom.isnot(None), ActivityLog.StageTo.isnot(None))
    
    # Order by most recent first
    query = query.order_by(ActivityLog.CreatedAt.desc())
    
    logs = query.all()
    
    # Format response
    return [
        ActivityLogResponse(
            ID=log.ID,
            DealID=log.DealID,
            ECode=log.ECode,
            UserName=log.user.Name if log.user else "Unknown",
            CreatedAt=log.CreatedAt,
            Action=log.Action,
            StageFrom=log.StageFrom,
            StageTo=log.StageTo,
            DealName=f"{log.deal.account.Name} - {log.deal.ServiceType}" if log.deal and log.deal.account else None
        )
        for log in logs
    ]

@router.post("/", response_model=ActivityLogResponse)
async def create_activity_log(
    log_entry: ActivityLogCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new activity log entry
    """
    # Verify deal exists
    deal = db.query(Deal).filter(Deal.ID == log_entry.DealID).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    
    # Create log entry with new stage fields
    db_log = ActivityLog(
        DealID=log_entry.DealID,
        ECode=current_user.ECode,  # Use the authenticated user's ECode
        Action=log_entry.Action,
        StageFrom=log_entry.StageFrom,
        StageTo=log_entry.StageTo
    )
    
    try:
        db.add(db_log)
        db.commit()
        db.refresh(db_log)
        
        # Format response
        return ActivityLogResponse(
            ID=db_log.ID,
            DealID=db_log.DealID,
            ECode=db_log.ECode,
            UserName=current_user.Name,
            CreatedAt=db_log.CreatedAt,
            Action=db_log.Action,
            StageFrom=db_log.StageFrom,
            StageTo=db_log.StageTo,
            DealName=f"{deal.account.Name} - {deal.ServiceType}" if deal.account else None
        )
    
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error creating activity log: {str(e)}")

@router.get("/stage-changes/{deal_id}", response_model=List[ActivityLogResponse])
async def get_deal_stage_history(
    deal_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get stage change history for a specific deal
    """
    # Verify deal exists
    deal = db.query(Deal).filter(Deal.ID == deal_id).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    
    # Get stage change logs for this deal
    stage_logs = db.query(ActivityLog).options(
        joinedload(ActivityLog.user),
        joinedload(ActivityLog.deal)
    ).filter(
        ActivityLog.DealID == deal_id,
        ActivityLog.StageFrom.isnot(None),
        ActivityLog.StageTo.isnot(None)
    ).order_by(ActivityLog.CreatedAt.desc()).all()
    
    return [
        ActivityLogResponse(
            ID=log.ID,
            DealID=log.DealID,
            ECode=log.ECode,
            UserName=log.user.Name if log.user else "Unknown",
            CreatedAt=log.CreatedAt,
            Action=log.Action,
            StageFrom=log.StageFrom,
            StageTo=log.StageTo,
            DealName=f"{log.deal.account.Name} - {log.deal.ServiceType}" if log.deal and log.deal.account else None
        )
        for log in stage_logs
    ] 


@router.get("/summary", response_model=List[ActivityLogSummary])
async def get_activity_log_summary(
    from_date: Optional[str] = Query(None, description="YYYY-MM-DD start date, inclusive"),
    to_date:   Optional[str] = Query(None, description="YYYY-MM-DD end date, inclusive"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # build base query
    query = (
        db.query(ActivityLog)
          .options(
              joinedload(ActivityLog.user),
              joinedload(ActivityLog.deal).joinedload(Deal.account)
          )
    )

    # apply from_date filter
    if from_date:
        try:
            start_dt = datetime.strptime(from_date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(400, detail="from_date must be YYYY-MM-DD")
        query = query.filter(ActivityLog.CreatedAt >= start_dt)

    # apply to_date filter (up through end of that day)
    if to_date:
        try:
            end_date = datetime.strptime(to_date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(400, detail="to_date must be YYYY-MM-DD")
        # include the full day
        end_dt = end_date + timedelta(days=1)
        query = query.filter(ActivityLog.CreatedAt < end_dt)

    # fetch and order
    logs = query.order_by(ActivityLog.CreatedAt.desc()).all()

    def get_account_name(log):
        acct = log.deal.account
        parts = []
        if acct and acct.Name:
            parts.append(acct.Name)
            if acct.Division:
                parts.append(acct.Division)
            if acct.Location:
                parts.append(acct.Location)
            return " - ".join(parts)
        return "Unknown Account"

    # format into your summary model
    return [
        ActivityLogSummary(
            user=        log.user.Name,
            account=     get_account_name(log),
            division=    log.deal.Division,
            service_type=log.deal.ServiceType,
            deal_value=  float(log.deal.DealValue) if log.deal.DealValue is not None else None,
            timestamp=   log.CreatedAt,
            action=      log.Action
        )
        for log in logs
    ]
