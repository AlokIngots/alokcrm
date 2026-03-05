from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional

from database.db import get_db
from database.tables.users import User, UserCreate, UserUpdate, UserResponse, UserWithManagerResponse, OUDesc
from database.tables.deals import Deal
from services.permission_service import PermissionService
import services.v2_sync_service as v2_sync_service
from api.v1.endpoints.auth import get_current_user
from services.access_scope_service import is_admin_user, is_sales_user
from services.business_rules import ADMIN_ROLES, division_aliases

router = APIRouter()

def ensure_admin_user(current_user: User):
    role = (current_user.Role or "").strip()
    if role not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Only admin can manage team members")

def format_user_response(user: User, ou_desc_mapping: dict = None) -> dict:
    """Helper function to format user with reporting manager name and OU names"""
    ou_desc_mapping = ou_desc_mapping or {}
    
    return {
        "ECode": user.ECode,
        "Name": user.Name,
        "Grade": user.Grade,
        "Designation": user.Designation,
        "Role": user.Role,
        "ReportingManagerECode": user.ReportingManagerECode,
        "ReportingManagerName": user.reporting_manager.Name if user.reporting_manager else None,
        "PhoneNumber": user.PhoneNumber,
        "DOUCode": user.DOUCode,
        "ZOUCode": user.ZOUCode,
        "COUCode": user.COUCode,
        "Division": ou_desc_mapping.get(user.DOUCode) if user.DOUCode else None,
        "Zone": ou_desc_mapping.get(user.ZOUCode) if user.ZOUCode else None,
        "Cluster": ou_desc_mapping.get(user.COUCode) if user.COUCode else None
    }

def get_all_subordinates_dfs(ecode: str, db: Session) -> List[dict]:
    """
    Depth-first search to find all subordinates of a given ECode
    Returns list of dicts with ECode and Name
    """
    subordinates = []
    
    try:
        # Find direct subordinates
        direct_subordinates = db.query(User).filter(User.ReportingManagerECode == ecode).all()
        
        for subordinate in direct_subordinates:
            subordinates.append({
                "ECode": subordinate.ECode,
                "Name": subordinate.Name
            })
            # Recursively find subordinates of this subordinate
            sub_subordinates = get_all_subordinates_dfs(subordinate.ECode, db)
            subordinates.extend(sub_subordinates)
    except Exception as e:
        # Log the error but don't stop the process
        print(f"Error in DFS for ECode {ecode}: {str(e)}")
    
    return subordinates

@router.get("/subordinates")
async def get_subordinates(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all subordinates for the current user using depth-first search.
    If current user role is 'MD Office', returns all ECodes.
    Current user is included in the returned list.
    """
    try:
        # Re-fetch the current user to ensure all attributes are loaded
        user = db.query(User).filter(User.ECode == current_user.ECode).first()
        if not user:
            raise HTTPException(status_code=404, detail="Current user not found in database")
        
        # Create current user details
        current_user_details = {"ECode": user.ECode, "Name": user.Name}
        
        # Check if current user role is MD Office
        if hasattr(user, 'Role') and user.Role == "MD Office":
            # Return all users with ECode and Name
            all_users = db.query(User.ECode, User.Name).all()
            all_users_list = [{"ECode": u.ECode, "Name": u.Name} for u in all_users]
            return {"subordinates": all_users_list}
        
        # Perform depth-first search to find all subordinates for current user
        subordinates = get_all_subordinates_dfs(user.ECode, db)
        
        return {"subordinates": [current_user_details] + subordinates}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching subordinates: {str(e)}")

@router.get("/", response_model=List[UserResponse])
async def get_all_users(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    division: Optional[str] = Query(None, description="Filter by division code"),
    zone: Optional[str] = Query(None, description="Filter by zone code"),
    cluster: Optional[str] = Query(None, description="Filter by cluster code")
):
    try:
        # Get OU descriptions
        ou_desc_result = db.query(OUDesc).filter(OUDesc.Status == '1').all()
        ou_desc_mapping = {row.OU_Code: row.OU_NAME for row in ou_desc_result}
        
        query = db.query(User).options(joinedload(User.reporting_manager))
        if is_sales_user(current_user) and not is_admin_user(current_user):
            query = query.filter(User.ECode == current_user.ECode)
        if division:
            query = query.filter(User.DOUCode == division)
        if zone:
            query = query.filter(User.ZOUCode == zone)
        if cluster:
            query = query.filter(User.COUCode == cluster)
        
        users = query.all()
        return [format_user_response(user, ou_desc_mapping) for user in users]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching users: {str(e)}")

@router.post("/", response_model=UserResponse)
async def create_user(
    user: UserCreate, 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a new user
    """
    ensure_admin_user(current_user)

    # Check permission to create users
    permission_service = PermissionService(db)
    permission_service.require_permission(current_user, "users", "create")
    
    # Check if user with ECode already exists
    existing_user = db.query(User).filter(User.ECode == user.ECode).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="User with this ECode already exists")
    
    # Validate reporting manager exists if provided
    if user.ReportingManagerECode:
        manager = db.query(User).filter(User.ECode == user.ReportingManagerECode).first()
        if not manager:
            raise HTTPException(status_code=400, detail="Reporting manager not found")
    
    try:
        # Get OU descriptions for response
        ou_desc_result = db.query(OUDesc).filter(OUDesc.Status == '1').all()
        ou_desc_mapping = {row.OU_Code: row.OU_NAME for row in ou_desc_result}
        
        db_user = User(**user.dict())
        db.add(db_user)
        v2_sync_service.sync_user(db, db_user)
        db.commit()
        db.refresh(db_user)
        
        # Fetch with reporting manager information
        user_with_manager = db.query(User).options(joinedload(User.reporting_manager)).filter(User.ECode == db_user.ECode).first()
        return format_user_response(user_with_manager, ou_desc_mapping)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error creating user: {str(e)}")

@router.put("/{ecode}", response_model=UserResponse)
async def update_user(
    ecode: str, 
    user_update: UserUpdate, 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update an existing user
    """
    ensure_admin_user(current_user)

    # Check permission to edit users
    permission_service = PermissionService(db)
    permission_service.require_permission(current_user, "users", "edit")
    
    user = db.query(User).filter(User.ECode == ecode).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        # Validate reporting manager exists if provided
        if user_update.ReportingManagerECode:
            manager = db.query(User).filter(User.ECode == user_update.ReportingManagerECode).first()
            if not manager:
                raise HTTPException(status_code=400, detail="Reporting manager not found")
        
        # Get OU descriptions for response
        ou_desc_result = db.query(OUDesc).filter(OUDesc.Status == '1').all()
        ou_desc_mapping = {row.OU_Code: row.OU_NAME for row in ou_desc_result}
        
        # Update only provided fields
        update_data = user_update.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(user, field, value)
        v2_sync_service.sync_user(db, user)
        db.commit()
        db.refresh(user)
        
        # Fetch with reporting manager information
        user_with_manager = db.query(User).options(joinedload(User.reporting_manager)).filter(User.ECode == ecode).first()
        return format_user_response(user_with_manager, ou_desc_mapping)
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error updating user: {str(e)}")


@router.delete("/{ecode}")
async def delete_user(
    ecode: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete a user
    """
    ensure_admin_user(current_user)

    user = db.query(User).filter(User.ECode == ecode).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if user has subordinates
    subordinates = db.query(User).filter(User.ReportingManagerECode == ecode).first()
    if subordinates:
        raise HTTPException(status_code=400, detail="Cannot delete user with subordinates")
    
    try:
        v2_sync_service.deactivate_user(db, ecode)
        db.delete(user)
        db.commit()
        return {"message": "User deleted successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error deleting user: {str(e)}")

@router.get("/filter-options")
async def get_filter_options(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    division: Optional[str] = Query(None, description="Filter by division code"),
    zone: Optional[str] = Query(None, description="Filter by zone code"),
    cluster: Optional[str] = Query(None, description="Filter by cluster code")
):
    try:
        # Re-fetch current user to ensure Access_Level is loaded
        user = db.query(User).filter(User.ECode == current_user.ECode).first()
        if not user:
            raise HTTPException(status_code=404, detail="Current user not found in database")
        # Alok standardized options: only Local/Export divisions, no Zone/Cluster usage.
        divisions = [
            {"code": "SCM", "name": "Export"},
            {"code": "TPT", "name": "Local"},
        ]

        # Salesperson options come from Users (authoritative), not AccessLevels legacy mapping.
        salespeople_query = db.query(User.ECode, User.Name, User.Role)

        if is_sales_user(user) and not is_admin_user(user):
            salespeople_query = salespeople_query.filter(User.ECode == user.ECode)
        else:
            # Keep team list focused to active business users.
            salespeople_query = salespeople_query.filter(
                User.Role.in_(["Sales", "Salesperson", "Manager", "MD Office", "Admin"])
            )

        if division:
            division_codes = division_aliases(division)
            deal_ecodes = [
                row[0]
                for row in db.query(Deal.SalespersonECode)
                .filter(Deal.SalespersonECode.isnot(None), Deal.Division.in_(division_codes))
                .distinct()
                .all()
            ]
            if deal_ecodes:
                salespeople_query = salespeople_query.filter(User.ECode.in_(deal_ecodes))
            else:
                # Fallback: also try user division field if populated.
                salespeople_query = salespeople_query.filter(User.DOUCode.in_(division_codes))

        sales_rows = salespeople_query.distinct().all()
        salespeople = [
            {"ECode": row[0], "Name": row[1]}
            for row in sales_rows
            if row[0] and row[1]
        ]
        salespeople.sort(key=lambda x: x["Name"].lower())

        return {
            "divisions": divisions,
            "zones": [],
            "clusters": [],
            "salespeople": salespeople,
            "access_level": user.Access_Level
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching filter options: {str(e)}")
