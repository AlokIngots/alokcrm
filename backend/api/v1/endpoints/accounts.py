from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List
from sqlalchemy import desc
from database.db import get_db
from database.tables.accounts import Account, AccountCreate, AccountUpdate, AccountResponse
from database.tables.blacklist_reason import BlacklistReason, BlacklistStatusEnum
from database.tables.users import User
from services.permission_service import PermissionService
import services.v2_sync_service as v2_sync_service
from api.v1.endpoints.auth import get_current_user
from services.access_scope_service import is_admin_user, is_sales_user
from pydantic import BaseModel
from typing import Optional

router = APIRouter()

class BlacklistTogglePayload(BaseModel):
    reason: Optional[str] = None
    notes: Optional[str] = None

def format_account_response(account: Account) -> dict:
    """Helper function to format account with related data"""
    return {
        "id": account.id,
        "Name": account.Name,
        "Industry": account.Industry,
        "Website": account.Website,
        "Turnover": account.Turnover,
        "SCM_KAM": account.SCM_KAM,
        "TPT_KAM": account.TPT_KAM,
        "Division": account.Division,  # New field
        "Location": account.Location,  # New field
        "Notes": account.Notes,
        "blacklist": account.blacklist,  # Include blacklist status
        "SCM_KAM_Name": account.scm_kam_user.Name if account.scm_kam_user else None,
        "TPT_KAM_Name": account.tpt_kam_user.Name if account.tpt_kam_user else None
    }

@router.get("/", response_model=List[AccountResponse])
async def get_all_accounts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Fetch all accounts with related information
    """
    try:
        query = db.query(Account).options(
            joinedload(Account.scm_kam_user),
            joinedload(Account.tpt_kam_user)
        )

        # Sales users can only view accounts linked to their own deals.
        if is_sales_user(current_user) and not is_admin_user(current_user):
            from database.tables.deals import Deal
            account_ids = db.query(Deal.AccountID).filter(
                Deal.SalespersonECode == current_user.ECode
            ).distinct().all()
            allowed_ids = [row[0] for row in account_ids]
            if not allowed_ids:
                return []
            query = query.filter(Account.id.in_(allowed_ids))

        accounts = query.all()
        return [format_account_response(account) for account in accounts]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching accounts: {str(e)}")

@router.post("/", response_model=AccountResponse)
async def create_account(
    account: AccountCreate, 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a new account
    """
    # Check permission to create accounts
    permission_service = PermissionService(db)
    permission_service.require_permission(current_user, "accounts", "create")
    
    try:
        # Validate SCM_KAM exists if provided
        if account.SCM_KAM:
            scm_kam = db.query(User).filter(User.ECode == account.SCM_KAM).first()
            if not scm_kam:
                raise HTTPException(status_code=400, detail="SCM KAM not found")
        
        # Validate TPT_KAM exists if provided
        if account.TPT_KAM:
            tpt_kam = db.query(User).filter(User.ECode == account.TPT_KAM).first()
            if not tpt_kam:
                raise HTTPException(status_code=400, detail="TPT KAM not found")
        
        # Create account
        db_account = Account(**account.dict())
        db.add(db_account)
        db.flush()
        v2_sync_service.sync_account(db, db_account)
        db.commit()
        db.refresh(db_account)
        
        # Fetch complete account information
        new_account = db.query(Account).options(
            joinedload(Account.scm_kam_user),
            joinedload(Account.tpt_kam_user)
        ).filter(Account.id == db_account.id).first()
        
        return format_account_response(new_account)
    
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error creating account: {str(e)}")


@router.put("/{account_id}", response_model=AccountResponse)
async def update_account(
    account_id: int, 
    account_update: AccountUpdate, 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update an existing company
    """
    # Check permission to edit accounts
    permission_service = PermissionService(db)
    permission_service.require_permission(current_user, "accounts", "edit")
    
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Company not found")
    
    # Validate SCM_KAM exists if provided
    if account_update.SCM_KAM:
        scm_user = db.query(User).filter(User.ECode == account_update.SCM_KAM).first()
        if not scm_user:
            raise HTTPException(status_code=400, detail=f"SCM_KAM user with ECode '{account_update.SCM_KAM}' not found")
    
    # Validate TPT_KAM exists if provided
    if account_update.TPT_KAM:
        tpt_user = db.query(User).filter(User.ECode == account_update.TPT_KAM).first()
        if not tpt_user:
            raise HTTPException(status_code=400, detail=f"TPT_KAM user with ECode '{account_update.TPT_KAM}' not found")
    
    # Update company fields
    update_data = account_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(account, field, value)
    v2_sync_service.sync_account(db, account)
    db.commit()
    db.refresh(account)
    
    # Reload account with relationships for proper formatting
    updated_account = db.query(Account).options(
        joinedload(Account.scm_kam_user),
        joinedload(Account.tpt_kam_user)
    ).filter(Account.id == account_id).first()
    
    return format_account_response(updated_account)

@router.delete("/{account_id}")
async def delete_company(
    account_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete an account
    """
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    try:
        v2_sync_service.delete_account(db, account_id)
        db.delete(account)
        db.commit()
        return {"message": f"Account {account_id} deleted successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error deleting account: {str(e)}")

@router.post("/{account_id}/blacklist/toggle")
async def toggle_account_blacklist(
    account_id: int,
    payload: BlacklistTogglePayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Toggle blacklist status for an account and record the reason
    """
    permission_service = PermissionService(db)
    permission_service.require_permission(current_user, "accounts", "blacklist")

    try:
        account = db.query(Account).filter(Account.id == account_id).first()
        if not account:
            raise HTTPException(status_code=404, detail="Account not found")

        new_status = not account.blacklist
        account.blacklist = new_status
        v2_sync_service.sync_account(db, account)
        db.commit()
        db.refresh(account)

        # Create blacklist reason record
        reason_entry = BlacklistReason(
            AccountID=account_id,
            Reason=payload.reason,
            Notes=payload.notes,
            Status=BlacklistStatusEnum.ENABLED if new_status else BlacklistStatusEnum.DISABLED,
            CreatedBy=current_user.ECode
        )
        db.add(reason_entry)
        db.commit()

        return {
            "message": f"Account {account_id} blacklist status {'enabled' if new_status else 'disabled'}",
            "account_id": account_id,
            "blacklist": new_status
        }

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error toggling blacklist: {str(e)}")

@router.get("/{account_id}/blacklist")
async def get_account_blacklist_status(
    account_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get blacklist status for a specific account, including latest reason and notes
    """
    permission_service = PermissionService(db)
    permission_service.require_permission(current_user, "accounts", "blacklist")

    try:
        account = db.query(Account).filter(Account.id == account_id).first()
        if not account:
            raise HTTPException(status_code=404, detail="Account not found")

        # Fetch the most recent blacklist reason
        latest_reason = (
            db.query(BlacklistReason)
            .filter(BlacklistReason.AccountID == account_id)
            .order_by(desc(BlacklistReason.CreatedAt))
            .first()
        )

        return {
            "account_id": account_id,
            "account_name": account.Name,
            "blacklist": account.blacklist,
            "reason": latest_reason.Reason if latest_reason else None,
            "notes": latest_reason.Notes if latest_reason else None,
            "created_at": latest_reason.CreatedAt if latest_reason else None,
            "created_by": latest_reason.CreatedBy if latest_reason else None
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching blacklist status: {str(e)}")

# Add a route to get all users for dropdown selection
@router.get("/helpers/users", response_model=List[dict])
async def get_users_for_kam_selection(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all users for KAM selection dropdown
    """
    users = db.query(User).all()
    return [{"ECode": user.ECode, "Name": user.Name} for user in users]
    permission_service = PermissionService(db)
    permission_service.require_permission(current_user, "accounts", "edit")
