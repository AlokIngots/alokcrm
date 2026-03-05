from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List

from database.db import get_db
from database.tables.deal_status import DealStatus, DealStatusCreate, DealStatusUpdate, DealStatusResponse, StatusEnum
from database.tables.deals import Deal

router = APIRouter()

def format_deal_status_response(deal_status: DealStatus) -> dict:
    """Helper function to format deal status with deal information"""
    deal_info = None
    if deal_status.deal and deal_status.deal.account:
        deal_info = f"{deal_status.deal.account.Name} - {deal_status.deal.ServiceType or 'Service'}"
    
    return {
        "ID": deal_status.ID,
        "DealID": deal_status.DealID,
        "DealInfo": deal_info,
        "Status": deal_status.Status,
        "Reason": deal_status.Reason,
        "Notes": deal_status.Notes
    }

@router.get("/", response_model=List[DealStatusResponse])
async def get_all_deal_statuses(db: Session = Depends(get_db)):
    """
    Fetch all deal statuses with deal information
    """
    try:
        deal_statuses = db.query(DealStatus).options(
            joinedload(DealStatus.deal).joinedload(Deal.account)
        ).all()
        return [format_deal_status_response(ds) for ds in deal_statuses]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching deal statuses: {str(e)}")

@router.get("/{status_id}", response_model=DealStatusResponse)
async def get_deal_status_by_id(status_id: int, db: Session = Depends(get_db)):
    """
    Fetch a specific deal status by ID
    """
    deal_status = db.query(DealStatus).options(
        joinedload(DealStatus.deal).joinedload(Deal.account)
    ).filter(DealStatus.ID == status_id).first()
    
    if not deal_status:
        raise HTTPException(status_code=404, detail="Deal status not found")
    
    return format_deal_status_response(deal_status)

@router.post("/", response_model=DealStatusResponse)
async def create_deal_status(deal_status: DealStatusCreate, db: Session = Depends(get_db)):
    """
    Create a new deal status entry
    """
    try:
        # Validate that the deal exists
        deal = db.query(Deal).filter(Deal.ID == deal_status.DealID).first()
        if not deal:
            raise HTTPException(status_code=400, detail="Deal not found")
        
        # Check if there's already an active status for this deal
        existing_status = db.query(DealStatus).filter(DealStatus.DealID == deal_status.DealID).first()
        if existing_status:
            raise HTTPException(
                status_code=400, 
                detail=f"Deal already has a status: {existing_status.Status}. Use PUT to update."
            )
        
        # Create deal status
        db_deal_status = DealStatus(**deal_status.dict())
        db.add(db_deal_status)
        db.commit()
        db.refresh(db_deal_status)
        
        # Fetch complete deal status information
        new_deal_status = db.query(DealStatus).options(
            joinedload(DealStatus.deal).joinedload(Deal.account)
        ).filter(DealStatus.ID == db_deal_status.ID).first()
        
        return format_deal_status_response(new_deal_status)
    
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error creating deal status: {str(e)}")

@router.put("/{status_id}", response_model=DealStatusResponse)
async def update_deal_status(status_id: int, deal_status_update: DealStatusUpdate, db: Session = Depends(get_db)):
    """
    Update an existing deal status
    """
    # Check if deal status exists
    deal_status = db.query(DealStatus).filter(DealStatus.ID == status_id).first()
    if not deal_status:
        raise HTTPException(status_code=404, detail="Deal status not found")
    
    try:
        update_data = deal_status_update.dict(exclude_unset=True)
        
        # Validate Deal if being updated
        if "DealID" in update_data:
            deal = db.query(Deal).filter(Deal.ID == update_data["DealID"]).first()
            if not deal:
                raise HTTPException(status_code=400, detail="Deal not found")
        
        # Update deal status
        for field, value in update_data.items():
            setattr(deal_status, field, value)
        
        db.commit()
        db.refresh(deal_status)
        
        # Fetch updated deal status with all relationships
        updated_deal_status = db.query(DealStatus).options(
            joinedload(DealStatus.deal).joinedload(Deal.account)
        ).filter(DealStatus.ID == status_id).first()
        
        return format_deal_status_response(updated_deal_status)
    
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error updating deal status: {str(e)}")

@router.delete("/{status_id}")
async def delete_deal_status(status_id: int, db: Session = Depends(get_db)):
    """
    Delete a deal status (removes hold/lost status, making deal active again)
    """
    deal_status = db.query(DealStatus).filter(DealStatus.ID == status_id).first()
    if not deal_status:
        raise HTTPException(status_code=404, detail="Deal status not found")
    
    try:
        db.delete(deal_status)
        db.commit()
        return {"message": "Deal status deleted successfully (deal is now active again)"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error deleting deal status: {str(e)}")

# Utility endpoints
@router.get("/deal/{deal_id}", response_model=DealStatusResponse)
async def get_deal_status_by_deal_id(deal_id: int, db: Session = Depends(get_db)):
    """
    Get deal status for a specific deal
    """
    deal_status = db.query(DealStatus).options(
        joinedload(DealStatus.deal).joinedload(Deal.account)
    ).filter(DealStatus.DealID == deal_id).first()
    
    if not deal_status:
        raise HTTPException(status_code=404, detail="No status found for this deal")
    
    return format_deal_status_response(deal_status)
