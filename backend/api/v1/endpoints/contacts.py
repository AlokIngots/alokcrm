from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List

from database.db import get_db
from database.tables.contacts import Contact, ContactCreate, ContactUpdate, ContactResponse
from database.tables.accounts import Account  # Changed from Company
from database.tables.users import User
from database.tables.deals import Deal
from services.permission_service import PermissionService
import services.v2_sync_service as v2_sync_service
from api.v1.endpoints.auth import get_current_user
from services.access_scope_service import is_admin_user, is_sales_user

router = APIRouter()

def format_contact_response(contact: Contact) -> dict:
    """Helper function to format contact with related data"""
    return {
        "id": contact.id,
        "Name": contact.Name,
        "AccountID": contact.AccountID,  # Changed from CompanyID
        "Account": contact.account.Name if contact.account else "Unknown Account",  # Changed
        "Designation": contact.Designation,
        "Email1": contact.Email1,
        "Email2": contact.Email2,
        "Phone1": contact.Phone1,
        "Phone2": contact.Phone2,
        "Notes": contact.Notes
    }

@router.get("/", response_model=List[ContactResponse])
async def get_all_contacts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Fetch all contacts with account information
    """
    try:
        query = db.query(Contact).options(
            joinedload(Contact.account)  # Changed from company
        )

        if is_sales_user(current_user) and not is_admin_user(current_user):
            allowed_account_ids = db.query(Deal.AccountID).filter(
                Deal.SalespersonECode == current_user.ECode
            ).distinct().all()
            allowed_ids = [row[0] for row in allowed_account_ids]
            if not allowed_ids:
                return []
            query = query.filter(Contact.AccountID.in_(allowed_ids))

        contacts = query.all()
        return [format_contact_response(contact) for contact in contacts]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching contacts: {str(e)}")

@router.get("/{contact_id}", response_model=ContactResponse)
async def get_contact_by_id(
    contact_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Fetch a specific contact by ID with account information
    """
    contact = db.query(Contact).options(
        joinedload(Contact.account)  # Changed from company
    ).filter(Contact.id == contact_id).first()
    
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    if is_sales_user(current_user) and not is_admin_user(current_user):
        has_access = db.query(Deal).filter(
            Deal.AccountID == contact.AccountID,
            Deal.SalespersonECode == current_user.ECode
        ).first()
        if not has_access:
            raise HTTPException(status_code=403, detail="Access denied for this contact")
    
    return format_contact_response(contact)

@router.post("/", response_model=ContactResponse)
async def create_contact(
    contact: ContactCreate, 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a new contact
    """
    # Check permission to create contacts
    permission_service = PermissionService(db)
    permission_service.require_permission(current_user, "contacts", "create")
    
    try:
        # Validate Account exists
        account = db.query(Account).filter(Account.id == contact.AccountID).first()  # Changed
        if not account:
            raise HTTPException(status_code=400, detail="Account not found")  # Changed
        
        # Create contact
        db_contact = Contact(**contact.dict())
        db.add(db_contact)
        db.flush()
        v2_sync_service.sync_contact(db, db_contact)
        db.commit()
        db.refresh(db_contact)
        
        # Fetch complete contact information
        new_contact = db.query(Contact).options(
            joinedload(Contact.account)  # Changed from company
        ).filter(Contact.id == db_contact.id).first()
        
        return format_contact_response(new_contact)
    
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error creating contact: {str(e)}")

@router.put("/{contact_id}", response_model=ContactResponse)
async def update_contact(
    contact_id: int, 
    contact_update: ContactUpdate, 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update an existing contact
    """
    # Check permission to edit contacts
    permission_service = PermissionService(db)
    permission_service.require_permission(current_user, "contacts", "edit")
    
    # Check if contact exists
    contact = db.query(Contact).filter(Contact.id == contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    try:
        update_data = contact_update.dict(exclude_unset=True)
        
        # Validate Account if being updated
        if "AccountID" in update_data:  # Changed from CompanyID
            account = db.query(Account).filter(Account.id == update_data["AccountID"]).first()  # Changed
            if not account:
                raise HTTPException(status_code=400, detail="Account not found")  # Changed
        
        # Update contact
        for field, value in update_data.items():
            setattr(contact, field, value)
        v2_sync_service.sync_contact(db, contact)
        db.commit()
        db.refresh(contact)
        
        # Fetch updated contact with all relationships
        updated_contact = db.query(Contact).options(
            joinedload(Contact.account)  # Changed from company
        ).filter(Contact.id == contact_id).first()
        
        return format_contact_response(updated_contact)
    
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error updating contact: {str(e)}")

@router.delete("/{contact_id}")
async def delete_contact(
    contact_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete a contact
    """
    contact = db.query(Contact).filter(Contact.id == contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    try:
        v2_sync_service.delete_contact(db, contact_id)
        db.delete(contact)
        db.commit()
        return {"message": "Contact deleted successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error deleting contact: {str(e)}")

@router.get("/search/by-account/{account_id}", response_model=List[ContactResponse])  # Changed
async def get_contacts_by_account_id(
    account_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):  # Changed
    """
    Fetch all contacts from a specific account by account ID
    """
    try:
        # Verify account exists
        account = db.query(Account).filter(Account.id == account_id).first()  # Changed
        if not account:
            raise HTTPException(status_code=404, detail="Account not found")  # Changed
        
        contacts = db.query(Contact).options(
            joinedload(Contact.account)  # Changed from company
        ).filter(Contact.AccountID == account_id).all()  # Changed from CompanyID
        
        return [format_contact_response(contact) for contact in contacts]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching contacts by account: {str(e)}")  # Changed

@router.get("/search/by-account-name/{account_name}", response_model=List[ContactResponse])  # Changed
async def get_contacts_by_account_name(
    account_name: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):  # Changed
    """
    Fetch all contacts from accounts with names containing the search term
    """
    try:
        query = db.query(Contact).join(Account).options(  # Changed from Company
            joinedload(Contact.account)  # Changed from company
        ).filter(Account.Name.ilike(f"%{account_name}%"))  # Changed from Company

        if is_sales_user(current_user) and not is_admin_user(current_user):
            allowed_account_ids = db.query(Deal.AccountID).filter(
                Deal.SalespersonECode == current_user.ECode
            ).distinct().all()
            allowed_ids = [row[0] for row in allowed_account_ids]
            if not allowed_ids:
                return []
            query = query.filter(Contact.AccountID.in_(allowed_ids))

        contacts = query.all()
        
        return [format_contact_response(contact) for contact in contacts]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching contacts by account name: {str(e)}")  # Changed
        if is_sales_user(current_user) and not is_admin_user(current_user):
            has_access = db.query(Deal).filter(
                Deal.AccountID == account_id,
                Deal.SalespersonECode == current_user.ECode
            ).first()
            if not has_access:
                return []
    permission_service = PermissionService(db)
    permission_service.require_permission(current_user, "contacts", "edit")
