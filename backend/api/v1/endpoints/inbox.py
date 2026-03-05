from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_
from typing import List

from database.db import get_db
from database.tables.deals import Deal, DealResponse, DealStatusEnum, DealFlagEnum
from database.tables.users import User
from database.tables.accounts import Account 
from database.tables.contacts import Contact
from database.tables.enquiries import Enquiry
from api.v1.endpoints.auth import get_current_user
from services.permission_service import PermissionService
from services.access_scope_service import is_admin_user, is_sales_user
from pydantic import BaseModel

router = APIRouter()

class ApprovalRequest(BaseModel):
    deal_id: int


def _normalize(value):
    return (value or "").strip().lower()


def _build_duplicate_enquiry_groups(
    db: Session,
    current_user: User,
):
    query = db.query(Enquiry).options(
        joinedload(Enquiry.account),
        joinedload(Enquiry.contact),
        joinedload(Enquiry.owner),
        joinedload(Enquiry.items),
    )

    if is_sales_user(current_user) and not is_admin_user(current_user):
        query = query.filter(Enquiry.OwnerECode == current_user.ECode)

    enquiries = query.order_by(Enquiry.CreatedAt.desc()).all()
    grouped = {}

    for enquiry in enquiries:
        items = enquiry.items or []
        if not items:
            signature = (
                enquiry.AccountID,
                _normalize(enquiry.BusinessType),
                "",
                "",
                "",
                "",
                "",
            )
            grouped.setdefault(signature, []).append((enquiry, None))
            continue

        for item in items:
            signature = (
                enquiry.AccountID,
                _normalize(enquiry.BusinessType),
                _normalize(item.Grade),
                _normalize(item.Shape),
                _normalize(item.Dia),
                _normalize(item.Qty),
                _normalize(item.Tolerance),
            )
            grouped.setdefault(signature, []).append((enquiry, item))

    duplicate_groups = []
    for signature, rows in grouped.items():
        by_enquiry_id = {}
        for enquiry, item in rows:
            if enquiry.id not in by_enquiry_id:
                by_enquiry_id[enquiry.id] = (enquiry, item)

        unique_rows = list(by_enquiry_id.values())
        if len(unique_rows) < 2:
            continue

        unique_rows.sort(key=lambda pair: pair[0].CreatedAt or pair[0].UpdatedAt, reverse=True)
        created_dates = {
            (row[0].CreatedAt.date() if row[0].CreatedAt else None)
            for row in unique_rows
        }
        created_dates.discard(None)
        # Strict duplicate rule: all matched enquiries must be created on the same date.
        if len(created_dates) > 1:
            continue

        base_enquiry, base_item = unique_rows[0]
        duplicate_groups.append({
            "type": "ENQUIRY_DUPLICATE",
            "duplicate_info": {
                "account_id": base_enquiry.AccountID,
                "account_name": base_enquiry.account.Name if base_enquiry.account else "Unknown Account",
                "business_type": base_enquiry.BusinessType,
                "match_signature": {
                    "grade": base_item.Grade if base_item else None,
                    "shape": base_item.Shape if base_item else None,
                    "dia": base_item.Dia if base_item else None,
                    "qty": base_item.Qty if base_item else None,
                    "tolerance": base_item.Tolerance if base_item else None,
                },
            },
            "duplicate_count": len(unique_rows),
            "enquiries": [
                {
                    "id": enquiry.id,
                    "account_name": enquiry.account.Name if enquiry.account else "Unknown Account",
                    "contact_name": enquiry.contact.Name if enquiry.contact else None,
                    "owner_ecode": enquiry.OwnerECode,
                    "owner_name": enquiry.owner.Name if enquiry.owner else None,
                    "status": enquiry.Status,
                    "source": enquiry.Source,
                    "business_type": enquiry.BusinessType,
                    "next_followup_date": enquiry.NextFollowupDate.isoformat() if enquiry.NextFollowupDate else None,
                    "created_at": enquiry.CreatedAt.isoformat() if enquiry.CreatedAt else None,
                }
                for enquiry, _ in unique_rows
            ],
        })

    duplicate_groups.sort(key=lambda group: group["duplicate_count"], reverse=True)
    return duplicate_groups

def format_deal_response_for_approval(deal: Deal) -> dict:
    """Helper function to format deal with all related data for approval"""
    return {
        "ID": deal.ID,
        "AccountID": deal.AccountID,  # Changed from CompanyID
        "AccountName": deal.account.Name if deal.account else "Unknown Account",  # Changed
        "SalespersonECode": deal.SalespersonECode,
        "SalespersonName": deal.salesperson.Name if deal.salesperson else "Unknown Salesperson",
        "ContactID": deal.ContactID,
        "ContactName": deal.contact.Name if deal.contact else "Unknown Contact",
        "ContactEmail": deal.contact.Email1 if deal.contact else None,
        "ContactPhone": deal.contact.Phone1 if deal.contact else None,
        "Division": deal.Division,
        "ServiceType": deal.ServiceType,
        "DealValue": deal.DealValue,
        "ExpectedClosureDate": deal.ExpectedClosureDate,
        "LeadGeneratedBy": deal.LeadGeneratedBy,
        "LeadGeneratorName": deal.lead_generator.Name if deal.lead_generator else None,
        "LeadSource": deal.LeadSource,
        "Stage": deal.Stage,
        "Notes": deal.Notes,
        "Status": deal.Status,
        "DisplayDeal": deal.DisplayDeal,
        "Flag": deal.Flag,
        "KAMECode": deal.KAMECode,
        "KAMName": deal.kam.Name if deal.kam else None,
        # Additional account details for approval context
        "AccountIndustry": deal.account.Industry if deal.account else None,  # Changed
        "AccountWebsite": deal.account.Website if deal.account else None,  # Changed
        "AccountTurnover": deal.account.Turnover if deal.account else None,  # Changed
        "AccountDivision": deal.account.Division if deal.account else None, 
        "AccountLocation": deal.account.Location if deal.account else None 
    }

@router.get("/")
async def get_pending_approvals(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all deals pending approval for the current user (KAM or duplicate approver)
    """
    pending_deals = []
    
    # Check permission for duplicate deals approval
    permission_service = PermissionService(db)
    can_approve_duplicates = permission_service.check_permission(current_user, "duplicate_deals", "approve")
    
    # Get KAM approval deals (deals with KAM_APPROVAL flag)
    kam_deals = db.query(Deal).filter(
        Deal.Status == DealStatusEnum.PENDING,
        Deal.Flag == DealFlagEnum.KAM_APPROVAL,
        Deal.KAMECode == current_user.ECode
    ).all()
    
    pending_deals.extend(kam_deals)
    
    # Get duplicate deals if user has permission
    if can_approve_duplicates:
        duplicate_deals = db.query(Deal).filter(
            Deal.Status == DealStatusEnum.PENDING,
            Deal.Flag == DealFlagEnum.DUPLICATE
        ).all()
        pending_deals.extend(duplicate_deals)
    
    # Format response with related data
    deals_response = []
    processed_duplicate_groups = set()  # Track processed duplicate groups
    
    for deal in pending_deals:
        # Skip if this deal is part of an already processed duplicate group
        if deal.Flag == DealFlagEnum.DUPLICATE:
            duplicate_key = (deal.AccountID, deal.Division, deal.ServiceType)
            if duplicate_key in processed_duplicate_groups:
                continue
            processed_duplicate_groups.add(duplicate_key)
        
        # Load deal with all relationships
        deal_with_relations = db.query(Deal).options(
            joinedload(Deal.account),
            joinedload(Deal.salesperson),
            joinedload(Deal.contact),
            joinedload(Deal.lead_generator),
            joinedload(Deal.kam)
        ).filter(Deal.ID == deal.ID).first()
        
        if deal.Flag == DealFlagEnum.DUPLICATE:
            # For duplicate deals, find all related duplicates
            all_duplicate_deals = db.query(Deal).options(
                joinedload(Deal.account),
                joinedload(Deal.salesperson),
                joinedload(Deal.contact),
                joinedload(Deal.lead_generator),
                joinedload(Deal.kam)
            ).filter(
                Deal.AccountID == deal.AccountID,
                Deal.Division == deal.Division,
                Deal.ServiceType == deal.ServiceType
            ).all()
            
            # Find existing approved deal (the original deal that the new ones are duplicating)
            existing_deal = next((d for d in all_duplicate_deals if d.Status == DealStatusEnum.APPROVED), None)
            
            # Find all new pending deals flagged as duplicates
            new_deals = [d for d in all_duplicate_deals if d.Flag == DealFlagEnum.DUPLICATE and d.Status == DealStatusEnum.PENDING]
            
            # Create response for duplicate group
            duplicate_response = {
                "type": "DUPLICATE",
                "flag": deal.Flag.value,
                "duplicate_info": {
                    "account_id": deal.AccountID,
                    "division": deal.Division,
                    "service_type": deal.ServiceType
                },
                "existing_deal": format_deal_response_for_approval(existing_deal) if existing_deal else None,
                "new_deals": [format_deal_response_for_approval(d) for d in new_deals]
            }
            deals_response.append(duplicate_response)
            
        else:
            # Regular KAM approval deal
            deal_response = format_deal_response_for_approval(deal_with_relations)
            deal_response["type"] = "KAM_APPROVAL"
            deal_response["flag"] = deal.Flag.value if deal.Flag else None
            deals_response.append(deal_response)
    
    enquiry_duplicates = _build_duplicate_enquiry_groups(db, current_user)
    return deals_response + enquiry_duplicates

@router.patch("/approve-deal/{deal_id}")
async def approve_deal(
    deal_id: int = Path(..., description="The ID of the deal to approve"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Approve a deal (change status to APPROVED)
    Only the appropriate KAM can approve deals
    """
    # Get the deal
    deal = db.query(Deal).filter(Deal.ID == deal_id).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    
    # Check authorization based on deal flag
    is_authorized = False
    permission_service = PermissionService(db)
    
    if deal.Flag == DealFlagEnum.KAM_APPROVAL:
        # KAM approval required - user must be the appropriate KAM
        if deal.KAMECode == current_user.ECode:
            is_authorized = True
    elif deal.Flag == DealFlagEnum.DUPLICATE:
        # Duplicate approval required - user must have duplicate_deals_approve permission
        is_authorized = permission_service.check_permission(current_user, "duplicate_deals", "approve")
    
    if not is_authorized:
        if deal.Flag == DealFlagEnum.KAM_APPROVAL:
            raise HTTPException(
                status_code=403, 
                detail=f"Not authorized to approve deals for {deal.Division} division of this account"
            )
        elif deal.Flag == DealFlagEnum.DUPLICATE:
            raise HTTPException(
                status_code=403, 
                detail="Not authorized to approve duplicate deals"
            )
        else:
            raise HTTPException(
                status_code=403, 
                detail="Not authorized to approve this deal"
            )
    
    # Check if deal is in pending status
    if deal.Status != DealStatusEnum.PENDING:
        raise HTTPException(
            status_code=400, 
            detail=f"Deal is already {deal.Status.value}. Only pending deals can be approved."
        )
    
    # Update deal status to APPROVED and reset flag
    deal.Status = DealStatusEnum.APPROVED
    deal.Flag = None
    db.commit()
    db.refresh(deal)
    
    return {"message": "Deal approved successfully", "deal_id": deal_id, "status": "APPROVED"}

@router.patch("/reject-deal/{deal_id}")
async def reject_deal(
    deal_id: int = Path(..., description="The ID of the deal to reject"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Reject a deal (change status to REJECTED)
    Only the appropriate KAM can reject deals
    """
    # Get the deal
    deal = db.query(Deal).filter(Deal.ID == deal_id).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    
    # Check authorization based on deal flag
    is_authorized = False
    permission_service = PermissionService(db)
    
    if deal.Flag == DealFlagEnum.KAM_APPROVAL:
        # KAM approval required - user must be the appropriate KAM
        if deal.KAMECode == current_user.ECode:
            is_authorized = True
    elif deal.Flag == DealFlagEnum.DUPLICATE:
        # Duplicate approval required - user must have duplicate_deals_approve permission
        is_authorized = permission_service.check_permission(current_user, "duplicate_deals", "approve")
    
    if not is_authorized:
        if deal.Flag == DealFlagEnum.KAM_APPROVAL:
            raise HTTPException(
                status_code=403, 
                detail=f"Not authorized to reject deals for {deal.Division} division of this account"
            )
        elif deal.Flag == DealFlagEnum.DUPLICATE:
            raise HTTPException(
                status_code=403, 
                detail="Not authorized to reject duplicate deals"
            )
        else:
            raise HTTPException(
                status_code=403, 
                detail="Not authorized to reject this deal"
            )
    
    # Check if deal is in pending status
    if deal.Status != DealStatusEnum.PENDING:
        raise HTTPException(
            status_code=400, 
            detail=f"Deal is already {deal.Status.value}. Only pending deals can be rejected."
        )
    
    # Update deal status to REJECTED and reset flag
    deal.Status = DealStatusEnum.REJECTED
    deal.Flag = None
    db.commit()
    db.refresh(deal)
    
    return {"message": "Deal rejected successfully", "deal_id": deal_id, "status": "REJECTED"}

@router.get("/stats")
async def get_approval_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get deal statistics for KAM approvals where current user is KAM but not salesperson
    """
    try:
        # Get deals where current user is KAM but not the salesperson
        kam_deals = db.query(Deal).filter(
            Deal.KAMECode == current_user.ECode,
            Deal.SalespersonECode != current_user.ECode
        ).all()
        
        # Count deals by status
        total_pending = 0
        total_approved = 0
        total_rejected = 0
        
        for deal in kam_deals:
            if deal.Status == DealStatusEnum.PENDING:
                total_pending += 1
            elif deal.Status == DealStatusEnum.APPROVED:
                total_approved += 1
            elif deal.Status == DealStatusEnum.REJECTED:
                total_rejected += 1
        
        return {
            "total_pending": total_pending,
            "total_approved": total_approved,
            "total_rejected": total_rejected
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching deal stats: {str(e)}")

@router.get("/my-accounts")  # Changed from my-companies
async def get_my_accounts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get accounts where current user is KAM
    """
    try:
        accounts = db.query(Account).filter(  # Changed from Company
            (Account.SCM_KAM == current_user.ECode) | 
            (Account.TPT_KAM == current_user.ECode)
        ).all()
        
        result = []
        for account in accounts:
            kam_roles = []
            if account.SCM_KAM == current_user.ECode:
                kam_roles.append("SCM")
            if account.TPT_KAM == current_user.ECode:
                kam_roles.append("TPT")
            
            result.append({
                "id": account.id,
                "Name": account.Name,
                "Industry": account.Industry,
                "Division": account.Division,  # New field
                "Location": account.Location,  # New field
                "KAM_Roles": kam_roles
            })
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching accounts: {str(e)}")  # Changed
