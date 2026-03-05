from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional

from database.db import get_db
from database.tables.enquiries import (
    Enquiry,
    EnquiryItem,
    EnquiryCreate,
    EnquiryUpdate,
    EnquiryResponse,
    EnquiryItemCreate,
    EnquiryItemResponse,
)
from database.tables.accounts import Account
from database.tables.contacts import Contact
from database.tables.users import User
from database.tables.deals import Deal, DealStatusEnum
from database.tables.material_masters import GradeCatalog, ToleranceChartRow
from api.v1.endpoints.auth import get_current_user
from services.access_scope_service import is_admin_user, is_sales_user
import services.v2_sync_service as v2_sync_service

router = APIRouter()


def _is_valid_grade(db: Session, grade_value: Optional[str]) -> bool:
    if not grade_value:
        return True
    value = grade_value.strip()
    if not value:
        return True

    grade = db.query(GradeCatalog).filter(
        (GradeCatalog.Code.ilike(value)) |
        (GradeCatalog.Name.ilike(value)) |
        (GradeCatalog.EquivalentGrade.ilike(value))
    ).first()
    return grade is not None


def _is_valid_tolerance(db: Session, tolerance_value: Optional[str]) -> bool:
    if not tolerance_value:
        return True
    value = tolerance_value.strip().lower()
    if not value:
        return True

    # Tolerance is stored as class code such as h9, f7, k10, e8.
    row = db.query(ToleranceChartRow).filter(ToleranceChartRow.ClassCode == value).first()
    return row is not None


def _validate_enquiry_item_masters(db: Session, item: EnquiryItemCreate):
    if not _is_valid_grade(db, item.Grade):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid grade '{item.Grade}'. Use grade code/name from Grade Master."
        )
    if not _is_valid_tolerance(db, item.Tolerance):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid tolerance '{item.Tolerance}'. Use tolerance class code (e.g., h9, f7, k10)."
        )


def format_enquiry_response(enquiry: Enquiry) -> dict:
    return {
        "id": enquiry.id,
        "AccountID": enquiry.AccountID,
        "ContactID": enquiry.ContactID,
        "OwnerECode": enquiry.OwnerECode,
        "Source": enquiry.Source,
        "BusinessType": enquiry.BusinessType,
        "Industry": enquiry.Industry,
        "Status": enquiry.Status,
        "NextFollowupDate": enquiry.NextFollowupDate,
        "FeasibilityStatus": enquiry.FeasibilityStatus,
        "TechNotes": enquiry.TechNotes,
        "AccountName": enquiry.account.Name if enquiry.account else None,
        "ContactName": enquiry.contact.Name if enquiry.contact else None,
        "OwnerName": enquiry.owner.Name if enquiry.owner else None,
        "CreatedAt": enquiry.CreatedAt,
        "UpdatedAt": enquiry.UpdatedAt,
        "Items": [
            EnquiryItemResponse(
                id=item.id,
                EnquiryID=item.EnquiryID,
                ProductID=item.ProductID,
                Grade=item.Grade,
                Shape=item.Shape,
                Dia=item.Dia,
                Qty=item.Qty,
                Tolerance=item.Tolerance,
                Application=item.Application,
                Notes=item.Notes,
            )
            for item in enquiry.items
        ],
    }


@router.get("/", response_model=List[EnquiryResponse])
async def get_all_enquiries(
    status: Optional[str] = Query(default=None),
    owner: Optional[str] = Query(default=None),
    industry: Optional[str] = Query(default=None),
    business_type: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Enquiry).options(
        joinedload(Enquiry.account),
        joinedload(Enquiry.contact),
        joinedload(Enquiry.owner),
        joinedload(Enquiry.items),
    )

    if status:
        query = query.filter(Enquiry.Status == status)
    if owner:
        query = query.filter(Enquiry.OwnerECode == owner)
    if industry:
        query = query.filter(Enquiry.Industry == industry)
    if business_type:
        query = query.filter(Enquiry.BusinessType == business_type)
    if search:
        query = query.join(Account, Enquiry.AccountID == Account.id).filter(Account.Name.ilike(f"%{search}%"))
    if is_sales_user(current_user) and not is_admin_user(current_user):
        query = query.filter(Enquiry.OwnerECode == current_user.ECode)

    enquiries = query.order_by(Enquiry.id.desc()).all()
    return [format_enquiry_response(enquiry) for enquiry in enquiries]


@router.get("/masters/grades")
async def get_enquiry_grade_master(
    q: Optional[str] = Query(default=None),
    limit: int = Query(default=200, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    query = db.query(GradeCatalog).filter(GradeCatalog.Active == True)  # noqa: E712
    if q:
        query = query.filter(
            (GradeCatalog.Code.ilike(f"%{q}%")) |
            (GradeCatalog.Name.ilike(f"%{q}%")) |
            (GradeCatalog.EquivalentGrade.ilike(f"%{q}%"))
        )

    rows = query.order_by(GradeCatalog.Code.asc()).limit(limit).all()
    return [
        {
            "code": g.Code,
            "name": g.Name,
            "standard": g.Standard,
            "equivalent_grade": g.EquivalentGrade,
            "label": f"{g.Code} - {g.Name}",
        }
        for g in rows
    ]


@router.get("/masters/tolerances")
async def get_enquiry_tolerance_master(
    fit_family: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    query = db.query(ToleranceChartRow)
    if fit_family:
        query = query.filter(ToleranceChartRow.FitFamily == fit_family.lower().strip())

    rows = query.order_by(
        ToleranceChartRow.FitFamily.asc(),
        ToleranceChartRow.ClassCode.asc(),
        ToleranceChartRow.DiameterMinMM.asc(),
    ).all()

    return [
        {
            "fit_family": r.FitFamily,
            "class_code": r.ClassCode,
            "diameter_min_mm": r.DiameterMinMM,
            "diameter_max_mm": r.DiameterMaxMM,
            "upper": r.UpperValue,
            "lower": r.LowerValue,
        }
        for r in rows
    ]


@router.get("/{enquiry_id}", response_model=EnquiryResponse)
async def get_enquiry_by_id(
    enquiry_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    enquiry = (
        db.query(Enquiry)
        .options(
            joinedload(Enquiry.account),
            joinedload(Enquiry.contact),
            joinedload(Enquiry.owner),
            joinedload(Enquiry.items),
        )
        .filter(Enquiry.id == enquiry_id)
        .first()
    )
    if not enquiry:
        raise HTTPException(status_code=404, detail="Enquiry not found")
    if is_sales_user(current_user) and not is_admin_user(current_user) and enquiry.OwnerECode != current_user.ECode:
        raise HTTPException(status_code=403, detail="Access denied for this enquiry")
    return format_enquiry_response(enquiry)


@router.post("/", response_model=EnquiryResponse)
async def create_enquiry(
    payload: EnquiryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    account = db.query(Account).filter(Account.id == payload.AccountID).first()
    if not account:
        raise HTTPException(status_code=400, detail="Account not found")

    owner = db.query(User).filter(User.ECode == payload.OwnerECode).first()
    if not owner:
        raise HTTPException(status_code=400, detail="Owner not found")
    if is_sales_user(current_user) and not is_admin_user(current_user) and payload.OwnerECode != current_user.ECode:
        raise HTTPException(status_code=403, detail="Sales user can create enquiries only for self")

    if payload.ContactID:
        contact = db.query(Contact).filter(Contact.id == payload.ContactID).first()
        if not contact:
            raise HTTPException(status_code=400, detail="Contact not found")

    try:
        for item in payload.Items:
            _validate_enquiry_item_masters(db, item)

        enquiry = Enquiry(
            AccountID=payload.AccountID,
            ContactID=payload.ContactID,
            OwnerECode=payload.OwnerECode,
            Source=payload.Source,
            BusinessType=payload.BusinessType,
            Industry=payload.Industry,
            Status=payload.Status or "NEW",
            NextFollowupDate=payload.NextFollowupDate,
            FeasibilityStatus=payload.FeasibilityStatus or "PENDING",
            TechNotes=payload.TechNotes,
        )
        db.add(enquiry)
        db.flush()
        v2_sync_service.sync_enquiry(db, enquiry, sale_type_hint=account.Division)

        for item in payload.Items:
            db.add(EnquiryItem(EnquiryID=enquiry.id, **item.dict()))
        v2_sync_service.sync_enquiry_items(db, enquiry.id)

        db.commit()
        db.refresh(enquiry)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error creating enquiry: {str(e)}")

    created = (
        db.query(Enquiry)
        .options(
            joinedload(Enquiry.account),
            joinedload(Enquiry.contact),
            joinedload(Enquiry.owner),
            joinedload(Enquiry.items),
        )
        .filter(Enquiry.id == enquiry.id)
        .first()
    )
    return format_enquiry_response(created)


@router.put("/{enquiry_id}", response_model=EnquiryResponse)
async def update_enquiry(
    enquiry_id: int,
    payload: EnquiryUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    enquiry = db.query(Enquiry).filter(Enquiry.id == enquiry_id).first()
    if not enquiry:
        raise HTTPException(status_code=404, detail="Enquiry not found")
    if is_sales_user(current_user) and not is_admin_user(current_user) and enquiry.OwnerECode != current_user.ECode:
        raise HTTPException(status_code=403, detail="Access denied for this enquiry")

    update_data = payload.dict(exclude_unset=True)
    if "AccountID" in update_data:
        account = db.query(Account).filter(Account.id == update_data["AccountID"]).first()
        if not account:
            raise HTTPException(status_code=400, detail="Account not found")
    if "ContactID" in update_data and update_data["ContactID"]:
        contact = db.query(Contact).filter(Contact.id == update_data["ContactID"]).first()
        if not contact:
            raise HTTPException(status_code=400, detail="Contact not found")
    if "OwnerECode" in update_data:
        owner = db.query(User).filter(User.ECode == update_data["OwnerECode"]).first()
        if not owner:
            raise HTTPException(status_code=400, detail="Owner not found")

    try:
        for field, value in update_data.items():
            setattr(enquiry, field, value)
        account_division = None
        if enquiry.AccountID:
            account_obj = db.query(Account).filter(Account.id == enquiry.AccountID).first()
            account_division = account_obj.Division if account_obj else None
        v2_sync_service.sync_enquiry(db, enquiry, sale_type_hint=account_division)
        db.commit()
        db.refresh(enquiry)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error updating enquiry: {str(e)}")

    updated = (
        db.query(Enquiry)
        .options(
            joinedload(Enquiry.account),
            joinedload(Enquiry.contact),
            joinedload(Enquiry.owner),
            joinedload(Enquiry.items),
        )
        .filter(Enquiry.id == enquiry.id)
        .first()
    )
    return format_enquiry_response(updated)


@router.post("/{enquiry_id}/items", response_model=EnquiryItemResponse)
async def add_enquiry_item(
    enquiry_id: int,
    payload: EnquiryItemCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    enquiry = db.query(Enquiry).filter(Enquiry.id == enquiry_id).first()
    if not enquiry:
        raise HTTPException(status_code=404, detail="Enquiry not found")
    if is_sales_user(current_user) and not is_admin_user(current_user) and enquiry.OwnerECode != current_user.ECode:
        raise HTTPException(status_code=403, detail="Access denied for this enquiry")

    try:
        _validate_enquiry_item_masters(db, payload)
        item = EnquiryItem(EnquiryID=enquiry_id, **payload.dict())
        db.add(item)
        v2_sync_service.sync_enquiry_items(db, enquiry_id)
        db.commit()
        db.refresh(item)
        return item
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error adding enquiry item: {str(e)}")


@router.post("/{enquiry_id}/convert-to-offer")
async def convert_enquiry_to_offer(
    enquiry_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    enquiry = db.query(Enquiry).filter(Enquiry.id == enquiry_id).first()
    if not enquiry:
        raise HTTPException(status_code=404, detail="Enquiry not found")
    if is_sales_user(current_user) and not is_admin_user(current_user) and enquiry.OwnerECode != current_user.ECode:
        raise HTTPException(status_code=403, detail="Access denied for this enquiry")

    if not enquiry.ContactID:
        raise HTTPException(status_code=400, detail="Enquiry must have a contact before conversion")

    try:
        deal = Deal(
            AccountID=enquiry.AccountID,
            ContactID=enquiry.ContactID,
            SalespersonECode=enquiry.OwnerECode,
            Division=None,
            ServiceType=enquiry.BusinessType,
            DealValue=None,
            ExpectedClosureDate=None,
            LeadGeneratedBy=enquiry.OwnerECode,
            LeadSource=enquiry.Source,
            Stage="NEW",
            Notes=enquiry.TechNotes,
            Status=DealStatusEnum.APPROVED,
            DisplayDeal=True,
        )
        db.add(deal)
        db.flush()
        enquiry.Status = "CONVERTED"
        account = db.query(Account).filter(Account.id == enquiry.AccountID).first()
        v2_sync_service.sync_enquiry(
            db,
            enquiry,
            sale_type_hint=account.Division if account else None
        )
        v2_sync_service.sync_pipeline_deal(db, deal, enquiry_id=enquiry.id)
        v2_sync_service.sync_deal_stage_history(
            db,
            deal_id=deal.ID,
            from_stage=None,
            to_stage=deal.Stage or "NEW",
            changed_by_ecode=current_user.ECode,
            reason="Created from enquiry conversion",
        )
        db.commit()
        db.refresh(deal)
        return {"message": "Enquiry converted to offer", "deal_id": deal.ID}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error converting enquiry: {str(e)}")
