from fastapi import APIRouter, Depends, HTTPException, Path, Body
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from datetime import date, datetime
from decimal import Decimal
import html
import re
import base64
from pathlib import Path as FilePath

from database.db import get_db
from database.tables.deals import Deal, DealCreate, DealUpdate, DealResponse, DealStatusEnum, DealDisplayUpdate, DealTemperatureEnum, DealTemperatureUpdate, DealFlagEnum
from database.tables.users import User
from database.tables.accounts import Account
from database.tables.contacts import Contact
from database.tables.enquiries import Enquiry
from database.tables.activity_log import ActivityLog
from services.deal_access_service import DealAccessService
from services.permission_service import PermissionService
from api.v1.endpoints.auth import get_current_user
from pydantic import BaseModel
from database.tables.activity_log import create_stage_change_log, create_temperature_change_log, create_duplicate_deal_log, create_salesperson_reassignment_log
from database.tables.notes import Note, NoteCreate, NoteUpdate, NoteResponse
import services.v2_sync_service as v2_sync_service
from services.business_rules import DEAL_STAGE_OFFER, normalize_sale_type, map_deal_stage_to_enquiry_status

router = APIRouter()


def _get_offer_logo_data_uri() -> str:
    """
    Embed logo as data URI so downloaded HTML always shows branding.
    """
    repo_root = FilePath(__file__).resolve().parents[4]
    candidates = [
        repo_root / "frontend" / "public" / "images" / "alok-ingots-logo.svg",
        repo_root / "frontend" / "public" / "images" / "Alok_logo.png",
        repo_root / "frontend" / "public" / "images" / "logo.png",
    ]

    for path in candidates:
        if not path.exists():
            continue
        raw = path.read_bytes()
        if path.suffix.lower() == ".svg":
            return f"data:image/svg+xml;base64,{base64.b64encode(raw).decode('ascii')}"
        if path.suffix.lower() == ".png":
            return f"data:image/png;base64,{base64.b64encode(raw).decode('ascii')}"

    return ""


def _extract_note_value(notes: Optional[str], prefix: str) -> Optional[str]:
    if not notes:
        return None
    for raw in notes.splitlines():
        line = raw.strip()
        if line.lower().startswith(prefix.lower()):
            return line.split(":", 1)[1].strip() if ":" in line else None
    return None


def _build_default_offer_no(deal: Deal) -> str:
    today = datetime.now()
    fy_start = today.year if today.month >= 4 else today.year - 1
    fy = f"{str(fy_start)[-2:]}-{str(fy_start + 1)[-2:]}"
    prefix = normalize_sale_type(deal.Division)
    return f"OFF-{deal.ID:04d}/{prefix}/{fy}"


def _parse_product_lines_from_notes(notes: Optional[str]) -> List[dict]:
    if not notes:
        return []

    lines = [line.strip() for line in notes.splitlines() if line.strip()]
    product_lines = [line for line in lines if re.match(r"^\d+\.\s*", line)]
    parsed = []

    for idx, line in enumerate(product_lines, start=1):
        clean = re.sub(r"^\d+\.\s*", "", line)
        parts = [p.strip() for p in clean.split("|")]

        row = {
            "sr_no": idx,
            "grade": "",
            "product": "",
            "size": "",
            "qty": "",
            "ht": "",
            "tol": "",
            "length": "",
            "rate": "",
        }

        if len(parts) > 0:
            row["product"] = parts[0]
        if len(parts) > 2:
            row["grade"] = parts[2]
        if len(parts) > 3:
            row["size"] = parts[3].replace("mm", " mm").strip()

        for part in parts:
            p = part.strip()
            l = p.lower()
            if l.startswith("qty:"):
                row["qty"] = p.split(":", 1)[1].strip()
            elif l.startswith("ht:"):
                row["ht"] = p.split(":", 1)[1].strip()
            elif l.startswith("tol:"):
                row["tol"] = p.split(":", 1)[1].strip()
            elif l.startswith("l:") or l.startswith("length:"):
                row["length"] = p.split(":", 1)[1].strip()
            elif l.startswith("price:") or l.startswith("rate:"):
                row["rate"] = p.split(":", 1)[1].strip()
            elif "dia:" in l and not row["size"]:
                row["size"] = p.split(":", 1)[1].strip()

        parsed.append(row)

    return parsed


def _render_offer_letter_html(deal: Deal) -> str:
    customer = deal.account.Name if deal.account else "Customer"
    offer_no = _extract_note_value(deal.Notes, "Offer No") or _build_default_offer_no(deal)
    logo_uri = _get_offer_logo_data_uri()
    product_rows = _parse_product_lines_from_notes(deal.Notes)
    if not product_rows:
        product_rows = [{
            "sr_no": 1,
            "grade": "",
            "product": deal.ServiceType or "",
            "size": "",
            "qty": "",
            "ht": "",
            "tol": "",
            "length": "",
            "rate": deal.DealValue or "",
        }]

    date_text = datetime.now().strftime("%d-%m-%Y")
    commercial = _extract_note_value(deal.Notes, "Commercial") or ""
    payment_terms = "-"
    delivery_days = "-"
    validity = "4 Days"
    if "Payment Terms=" in commercial:
        payment_terms = commercial.split("Payment Terms=", 1)[1].split(",", 1)[0].strip() or "-"
    if "Delivery=" in commercial:
        delivery_days = commercial.split("Delivery=", 1)[1].split(",", 1)[0].strip() or "-"

    body_rows = []
    for row in product_rows:
        body_rows.append(
            f"""
            <tr>
              <td>{row['sr_no']}</td>
              <td>{html.escape(str(row['grade'] or '-'))}</td>
              <td>{html.escape(str(row['product'] or '-'))}</td>
              <td>{html.escape(str(row['size'] or '-'))}</td>
              <td>{html.escape(str(row['qty'] or '-'))}</td>
              <td>{html.escape(str(row['ht'] or '-'))}</td>
              <td>{html.escape(str(row['tol'] or '-'))}</td>
              <td>{html.escape(str(row['length'] or '-'))}</td>
              <td>{html.escape(str(row['rate'] or '-'))}</td>
            </tr>
            """
        )

    logo_html = (
        f'<img class="logo" src="{logo_uri}" alt="Alok Ingots" />'
        if logo_uri else
        '<div class="logo-fallback">ALOK INGOTS</div>'
    )

    return f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>Offer Letter - {html.escape(offer_no)}</title>
      <style>
        @page {{ size: A4; margin: 18mm 14mm; }}
        body {{ font-family: 'Segoe UI', Arial, sans-serif; margin: 0; color: #111827; background: #fff; }}
        .sheet {{ max-width: 210mm; margin: 0 auto; }}
        .header {{ display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 10px; }}
        .logo {{ height: 72px; width: auto; object-fit: contain; }}
        .logo-fallback {{ font-size: 28px; font-weight: 800; letter-spacing: 1px; }}
        .header-right {{ text-align: right; font-size: 12px; color: #4b5563; }}
        .company-line {{ border-top: 1px solid #d1d5db; margin: 10px 0 14px; }}
        .topmeta {{ display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; }}
        .cert {{ font-size: 12px; color: #374151; letter-spacing: 0.3px; }}
        .date {{ font-size: 30px; font-weight: 800; }}
        .meta {{ margin-bottom: 14px; }}
        .meta p {{ margin: 6px 0; font-size: 14px; }}
        .meta .k {{ display:inline-block; min-width: 150px; font-weight: 700; color: #111827; }}
        .meta .v {{ font-weight: 700; font-size: 16px; letter-spacing: 0.2px; }}
        table {{ width:100%; border-collapse: collapse; margin-top:10px; }}
        th, td {{ border:1px solid #9ca3af; padding:7px 6px; font-size:12px; text-align:center; vertical-align:middle; }}
        th {{ background:#f3f4f6; font-weight: 700; }}
        td:nth-child(4), td:nth-child(5), td:nth-child(6), td:nth-child(7), td:nth-child(8), td:nth-child(9) {{ font-size: 11px; }}
        .terms {{ margin-top: 18px; max-width: 520px; }}
        .terms-row {{ display:flex; align-items:flex-start; margin: 6px 0; font-size: 14px; }}
        .terms-k {{ width: 140px; font-weight: 700; }}
        .terms-v {{ font-weight: 600; }}
        .footer {{ margin-top: 34px; border-top: 2px solid #e57f36; padding-top: 10px; font-size: 11px; color:#1f2937; display:flex; justify-content:space-between; gap: 20px; }}
        .footer h4 {{ margin: 0 0 4px; font-size: 12px; font-weight: 800; }}
        .footer p {{ margin: 0; line-height: 1.45; }}
      </style>
    </head>
    <body>
      <div class="sheet">
      <div class="header">
        <div class="header-left">
          {logo_html}
        </div>
        <div class="header-right">AN ISO 9001:2015</div>
      </div>
      <div class="company-line"></div>
      <div class="topmeta">
        <div class="cert">CERTIFIED COMPANY</div>
        <div class="date">DATE : {date_text}</div>
      </div>
      <div class="meta">
        <p><span class="k">CUSTOMER</span>: <span class="v">{html.escape(customer)}</span></p>
        <p><span class="k">OFFER NUMBER</span>: <span class="v">{html.escape(offer_no)}</span></p>
      </div>
      <table>
        <thead>
          <tr>
            <th>Sr no</th><th>Grade</th><th>Product</th><th>Size</th><th>Qty</th><th>HT</th><th>TOL</th><th>Length</th><th>Rate</th>
          </tr>
        </thead>
        <tbody>
          {''.join(body_rows)}
        </tbody>
      </table>
      <div class="terms">
        <div class="terms-row"><div class="terms-k">Validity</div><div class="terms-v">: {html.escape(validity)}</div></div>
        <div class="terms-row"><div class="terms-k">Delivery Days</div><div class="terms-v">: {html.escape(delivery_days)}</div></div>
        <div class="terms-row"><div class="terms-k">Payment Terms</div><div class="terms-v">: {html.escape(payment_terms)}</div></div>
      </div>
      <div class="footer">
        <div>
          <h4>ALOK INGOTS (MUMBAI) PVT LTD</h4>
          <p>602, Raheja Chambers, 213 Free Press,<br/>Journal Marg, Nariman Point 400021, India<br/>Tel: +91 22 4022008</p>
        </div>
        <div>
          <h4>MANUFACTURING UNIT</h4>
          <p>Plot 95/3/2, Vijaypur Village,<br/>Near Kone Gaon,<br/>Taluka Wada Dist Palghar 421 303</p>
        </div>
      </div>
      </div>
    </body>
    </html>
    """

def format_deal_response_with_access(deal: Deal, is_draggable: bool = False) -> dict:
    """Helper function to format deal with related data and access controls"""
    
    account_name = "Unknown Account"
    if deal.account:
        account_parts = [deal.account.Name]
        if deal.account.Division:
            account_parts.append(deal.account.Division)
        if deal.account.Location:
            account_parts.append(deal.account.Location)
        account_name = " - ".join(account_parts)
    
    return {
        "ID": deal.ID,
        "AccountID": deal.AccountID,
        "AccountName": account_name,
        "SalespersonECode": deal.SalespersonECode,
        "SalespersonName": deal.salesperson.Name if deal.salesperson else "Unknown Salesperson",
        "ContactID": deal.ContactID,
        "ContactName": deal.contact.Name if deal.contact else "Unknown Contact",
        "Division": deal.Division,
        "ServiceType": deal.ServiceType,
        "DealValue": deal.DealValue,
        "ExpectedClosureDate": deal.ExpectedClosureDate,
        "LeadGeneratedBy": deal.LeadGeneratedBy,
        "LeadGeneratedByName": deal.lead_generator.Name if deal.lead_generator else None,
        "LeadSource": deal.LeadSource,
        "Stage": deal.Stage,
        "Notes": deal.Notes,
        "Status": deal.Status,
        "DisplayDeal": deal.DisplayDeal,
        "Temperature": deal.Temperature,
        "Flag": deal.Flag,
        "KAMECode": deal.KAMECode,
        "KAMName": deal.kam.Name if deal.kam else None,
        "Draggable": is_draggable
    }


def _sync_related_enquiry_status(db: Session, deal: Deal, new_stage: str) -> None:
    """
    Keep enquiry status aligned with pipeline stage for the matching enquiry.
    """
    enquiry = (
        db.query(Enquiry)
        .filter(
            Enquiry.AccountID == deal.AccountID,
            Enquiry.ContactID == deal.ContactID,
            Enquiry.OwnerECode == deal.SalespersonECode,
        )
        .order_by(Enquiry.id.desc())
        .first()
    )
    if not enquiry:
        return

    next_status = map_deal_stage_to_enquiry_status(new_stage)
    if enquiry.Status == next_status:
        return

    enquiry.Status = next_status
    v2_sync_service.sync_enquiry(db, enquiry, sale_type_hint=deal.Division)

@router.get("/", response_model=List[DealResponse])
async def get_all_deals(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Fetch all deals user is authorized to view with proper access controls
    Role-based access: MD Office sees all, Lead Generator sees generated deals + standard access
    """
    try:
        access_service = DealAccessService(db)
        authorized_deals = access_service.get_authorized_deals(
            current_user.ECode, 
            current_user.Role
        )
        
        formatted_deals = []
        for deal_info in authorized_deals:
            deal = deal_info['deal']
            is_subordinate = deal_info['is_subordinate']
            
            # Load relationships
            deal_with_relations = db.query(Deal).options(
                joinedload(Deal.account),
                joinedload(Deal.salesperson),
                joinedload(Deal.contact),
                joinedload(Deal.lead_generator),
                joinedload(Deal.kam)
            ).filter(Deal.ID == deal.ID).first()
            
            # Determine if deal is draggable
            is_draggable = access_service.is_deal_draggable(
                deal_with_relations, 
                current_user.ECode, 
                is_subordinate
            )
            
            formatted_deal = format_deal_response_with_access(deal_with_relations, is_draggable)
            formatted_deals.append(formatted_deal)
        
        return formatted_deals
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching deals: {str(e)}")

@router.get("/{deal_id}", response_model=DealResponse)
async def get_deal_by_id(
    deal_id: int, 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Fetch a specific deal by ID with access control validation
    """
    access_service = DealAccessService(db)
    
    # Check access using enhanced service
    if not access_service.has_deal_access(current_user.ECode, deal_id, current_user.Role):
        raise HTTPException(status_code=403, detail="Access denied to this deal")
    
    deal = db.query(Deal).options(
        joinedload(Deal.account),
        joinedload(Deal.salesperson),
        joinedload(Deal.contact),
        joinedload(Deal.lead_generator),
        joinedload(Deal.kam)
    ).filter(Deal.ID == deal_id).first()
    
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    
    # Find if this is a subordinate deal
    authorized_deals = access_service.get_authorized_deals(current_user.ECode, current_user.Role)
    is_subordinate = any(
        deal_info['deal'].ID == deal_id and deal_info['is_subordinate'] 
        for deal_info in authorized_deals
    )
    
    is_draggable = access_service.is_deal_draggable(deal, current_user.ECode, is_subordinate)
    
    return format_deal_response_with_access(deal, is_draggable)


@router.get("/{deal_id}/offer-letter")
async def download_offer_letter(
    deal_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Download offer letter for a deal as an HTML file.
    """
    access_service = DealAccessService(db)
    if not access_service.has_deal_access(current_user.ECode, deal_id, current_user.Role):
        raise HTTPException(status_code=403, detail="Access denied to this deal")

    deal = db.query(Deal).options(
        joinedload(Deal.account),
        joinedload(Deal.contact),
        joinedload(Deal.salesperson),
    ).filter(Deal.ID == deal_id).first()

    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")

    if deal.Stage != DEAL_STAGE_OFFER:
        raise HTTPException(status_code=400, detail="Offer letter can be downloaded only in Offer stage")

    offer_html = _render_offer_letter_html(deal)
    filename = f"offer-letter-{deal_id}.html"
    return HTMLResponse(
        content=offer_html,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

@router.post("/", response_model=DealResponse)
async def create_deal(
    deal: DealCreate, 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a new deal with automatic status determination based on KAM availability
    """
    # Check permission to create deals
    permission_service = PermissionService(db)
    permission_service.require_permission(current_user, "deals", "create")
    
    try:
        # Validate Account exists
        account = db.query(Account).filter(Account.id == deal.AccountID).first()
        if not account:
            raise HTTPException(status_code=400, detail="Account not found")
        
        # Validate Salesperson exists
        salesperson = db.query(User).filter(User.ECode == deal.SalespersonECode).first()
        if not salesperson:
            raise HTTPException(status_code=400, detail="Salesperson not found")
        
        # Validate Contact exists
        contact = db.query(Contact).filter(Contact.id == deal.ContactID).first()
        if not contact:
            raise HTTPException(status_code=400, detail="Contact not found")
        
        # Validate Lead Generator exists if provided
        if deal.LeadGeneratedBy:
            lead_generator = db.query(User).filter(User.ECode == deal.LeadGeneratedBy).first()
            if not lead_generator:
                raise HTTPException(status_code=400, detail="Lead Generator not found")
        
        # Validate Contact belongs to the specified Account
        if contact.AccountID != deal.AccountID:
            raise HTTPException(status_code=400, detail="Contact does not belong to the specified Account")
        
        # Helper function to check for duplicate deals
        def check_for_duplicates():
            """Check for duplicate deals excluding DEAL_WON and DEAL_LOST stages"""
            return db.query(Deal).filter(
                Deal.AccountID == deal.AccountID,
                Deal.Division == deal.Division,
                Deal.ServiceType == deal.ServiceType,
                ~Deal.Stage.in_(["DEAL_WON", "DEAL_LOST"])
            ).first()
        
        # Helper function to determine status based on duplicates
        def get_status_and_flag_from_duplicates():
            """Return status and flag based on duplicate check"""
            if check_for_duplicates():
                return DealStatusEnum.PENDING, DealFlagEnum.DUPLICATE
            else:
                return DealStatusEnum.APPROVED, None
        
        # Determine deal status, flag and KAM based on division and account
        deal_status = DealStatusEnum.PENDING  # Default status
        deal_flag = None  # Default flag
        kam_ecode = None  # KAM to be assigned
        
        if deal.Division:
            # Determine the KAM based on division
            if deal.Division == "TPT" and account.TPT_KAM:
                kam_ecode = account.TPT_KAM
            elif deal.Division == "SCM" and account.SCM_KAM:
                kam_ecode = account.SCM_KAM
            
            if kam_ecode:
                # Check if salesperson is the same as KAM
                if deal.SalespersonECode == kam_ecode:
                    # Salesperson is KAM, no approval needed - check for duplicates
                    deal_status, deal_flag = get_status_and_flag_from_duplicates()
                else:
                    # KAM is different from salesperson, requires KAM approval
                    deal_status = DealStatusEnum.PENDING
                    deal_flag = DealFlagEnum.KAM_APPROVAL
            else:
                # No KAM assigned, check for duplicates
                deal_status, deal_flag = get_status_and_flag_from_duplicates()

        # Create deal with determined status, flag, and KAM
        db_deal = Deal(
            **deal.dict(),
            Status=deal_status,
            Flag=deal_flag,
            KAMECode=kam_ecode
        )
        db.add(db_deal)
        db.flush()
        v2_sync_service.sync_pipeline_deal(db, db_deal)
        v2_sync_service.sync_deal_stage_history(
            db,
            deal_id=db_deal.ID,
            from_stage=None,
            to_stage=db_deal.Stage or "NEW",
            changed_by_ecode=current_user.ECode,
            reason="Deal created",
        )
        db.commit()
        db.refresh(db_deal)
        
        # Create activity log for duplicate deals
        if deal_flag == DealFlagEnum.DUPLICATE:
            create_duplicate_deal_log(
                db=db,
                deal_id=db_deal.ID,
                user_ecode=current_user.ECode
            )
            db.commit()
        
        # Fetch complete deal information
        new_deal = db.query(Deal).options(
            joinedload(Deal.account),
            joinedload(Deal.salesperson),
            joinedload(Deal.contact),
            joinedload(Deal.lead_generator),
            joinedload(Deal.kam)
        ).filter(Deal.ID == db_deal.ID).first()
        
        # Determine if the deal is draggable
        # Auto-approved deals (no KAM) are draggable, pending deals are not
        is_draggable = deal_status == DealStatusEnum.APPROVED
        
        return format_deal_response_with_access(new_deal, is_draggable)
    
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error creating deal: {str(e)}")

@router.put("/{deal_id}", response_model=DealResponse)
async def update_deal(
    deal_id: int, 
    deal_update: DealUpdate, 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update an existing deal - only DealValue and ExpectedClosureDate can be modified
    Access control: Only salesperson or appropriate KAM can update
    """
    # Check if deal exists and user has access
    access_service = DealAccessService(db)
    authorized_deals = access_service.get_authorized_deals(current_user.ECode)
    
    authorized_deal_ids = {deal_info['deal'].ID for deal_info in authorized_deals}
    if deal_id not in authorized_deal_ids:
        raise HTTPException(status_code=403, detail="Access denied to this deal")
    
    deal = db.query(Deal).filter(Deal.ID == deal_id).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    
    # Check if user can edit (not subordinate deal)
    is_subordinate = any(
        deal_info['deal'].ID == deal_id and deal_info['is_subordinate'] 
        for deal_info in authorized_deals
    )
    
    if is_subordinate:
        raise HTTPException(status_code=403, detail="Cannot edit subordinate deals")
    
    try:
        update_data = deal_update.dict(exclude_unset=True)
        
        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        if "DealValue" in update_data:
            deal.DealValue = update_data["DealValue"]
        
        if "ExpectedClosureDate" in update_data:
            deal.ExpectedClosureDate = update_data["ExpectedClosureDate"]
        v2_sync_service.sync_pipeline_deal(db, deal)
        db.commit()
        db.refresh(deal)
        
        # Fetch updated deal with all relationships
        updated_deal = db.query(Deal).options(
            joinedload(Deal.account),
            joinedload(Deal.salesperson),
            joinedload(Deal.contact),
            joinedload(Deal.lead_generator),
            joinedload(Deal.kam)
        ).filter(Deal.ID == deal_id).first()
        
        is_draggable = access_service.is_deal_draggable(updated_deal, current_user.ECode, False)
        
        return format_deal_response_with_access(updated_deal, is_draggable)
    
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error updating deal: {str(e)}")

# Additional utility endpoints
@router.get("/account/{account_id}", response_model=List[DealResponse])
async def get_deals_by_account(
    account_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get all deals for a specific account
    """
    try:
        access_service = DealAccessService(db)
        authorized_deals = access_service.get_authorized_deals(current_user.ECode, current_user.Role)
        account_deals = [item for item in authorized_deals if item["deal"].AccountID == account_id]

        formatted_deals = []
        for deal_info in account_deals:
            deal = db.query(Deal).options(
                joinedload(Deal.account),
                joinedload(Deal.salesperson),
                joinedload(Deal.contact),
                joinedload(Deal.lead_generator),
                joinedload(Deal.kam)
            ).filter(Deal.ID == deal_info["deal"].ID).first()
            is_draggable = access_service.is_deal_draggable(deal, current_user.ECode, deal_info["is_subordinate"])
            formatted_deals.append(format_deal_response_with_access(deal, is_draggable))

        return formatted_deals
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching deals by account: {str(e)}")

@router.get("/salesperson/{ecode}", response_model=List[DealResponse])
async def get_deals_by_salesperson(
    ecode: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get all deals for a specific salesperson
    """
    try:
        access_service = DealAccessService(db)
        if current_user.Role in {"Sales", "Salesperson"} and ecode != current_user.ECode:
            raise HTTPException(status_code=403, detail="Sales user can only access own deals")

        authorized_deals = access_service.get_authorized_deals(current_user.ECode, current_user.Role)
        salesperson_deals = [
            item for item in authorized_deals
            if item["deal"].SalespersonECode == ecode
        ]

        formatted_deals = []
        for deal_info in salesperson_deals:
            deal = db.query(Deal).options(
                joinedload(Deal.account),
                joinedload(Deal.salesperson),
                joinedload(Deal.contact),
                joinedload(Deal.lead_generator),
                joinedload(Deal.kam)
            ).filter(Deal.ID == deal_info["deal"].ID).first()
            is_draggable = access_service.is_deal_draggable(deal, current_user.ECode, deal_info["is_subordinate"])
            formatted_deals.append(format_deal_response_with_access(deal, is_draggable))

        return formatted_deals
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching deals by salesperson: {str(e)}")

# Add this new Pydantic model for stage update
class DealStageUpdate(BaseModel):
    Stage: str

@router.patch("/{deal_id}/stage", response_model=DealResponse)
async def update_deal_stage(
    deal_id: int = Path(..., description="The ID of the deal to update"),
    stage_update: DealStageUpdate = Body(..., description="The new stage value"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update only the stage of a specific deal with access control and automatic activity logging
    """
    # Access control check with role-based access
    access_service = DealAccessService(db)
    if not access_service.has_deal_access(current_user.ECode, deal_id, current_user.Role):
        raise HTTPException(status_code=403, detail="Access denied to this deal")
    
    deal = db.query(Deal).filter(Deal.ID == deal_id).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    
    # Check if user can edit (not subordinate deal and not lead generator viewing only)
    authorized_deals = access_service.get_authorized_deals(current_user.ECode, current_user.Role)
    deal_access_info = next(
        (info for info in authorized_deals if info['deal'].ID == deal_id), 
        None
    )
    
    if not deal_access_info:
        raise HTTPException(status_code=403, detail="Access denied to this deal")
    
    # Lead generators can only view deals they generated, not edit them unless they're also salesperson/KAM
    if (deal_access_info['access_type'] == 'lead_generator' and 
        deal.SalespersonECode != current_user.ECode and
        not access_service.is_user_kam_for_deal(current_user.ECode, deal)):
        raise HTTPException(status_code=403, detail="Lead generators can only view deals, not edit them")
    
    if deal_access_info['is_subordinate']:
        raise HTTPException(status_code=403, detail="Cannot edit subordinate deals")
    
    try:
        # Store the old stage before updating
        old_stage = deal.Stage or "Not Set"
        new_stage = stage_update.Stage
        
        # Only create activity log if stage actually changed
        if old_stage != new_stage:
            # Update the deal stage
            deal.Stage = new_stage
            
            # Create activity log for stage change
            create_stage_change_log(
                db=db,
                deal_id=deal_id,
                user_ecode=current_user.ECode,
                stage_from=old_stage,
                stage_to=new_stage
            )
            v2_sync_service.sync_pipeline_deal(db, deal)
            v2_sync_service.sync_deal_stage_history(
                db,
                deal_id=deal_id,
                from_stage=old_stage,
                to_stage=new_stage,
                changed_by_ecode=current_user.ECode,
                reason=f"Moved from {old_stage} to {new_stage}",
            )
            if v2_sync_service.normalize_stage(new_stage) == "OFFER":
                offer_no = _extract_note_value(deal.Notes, "Offer No") or _build_default_offer_no(deal)
                payment_terms = _extract_note_value(deal.Notes, "Payment Terms")
                delivery_days = _extract_note_value(deal.Notes, "Delivery")
                v2_sync_service.ensure_v2_offer_for_deal(
                    db=db,
                    deal_id=deal.ID,
                    offer_number=offer_no,
                    created_by_ecode=current_user.ECode,
                    payment_terms=payment_terms,
                    delivery_days=delivery_days,
                )
            _sync_related_enquiry_status(db, deal, new_stage)
        
        db.commit()
        db.refresh(deal)
        
        updated_deal = db.query(Deal).options(
            joinedload(Deal.account),
            joinedload(Deal.salesperson),
            joinedload(Deal.contact),
            joinedload(Deal.lead_generator),
            joinedload(Deal.kam)
        ).filter(Deal.ID == deal_id).first()
        
        is_draggable = access_service.is_deal_draggable(updated_deal, current_user.ECode, False)
        
        return format_deal_response_with_access(updated_deal, is_draggable)
    
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error updating deal stage: {str(e)}")

@router.patch("/{deal_id}/toggle-display")
async def toggle_deal_display(
    display_update: DealDisplayUpdate,
    deal_id: int = Path(..., description="The ID of the deal to toggle display"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Toggle deal display with access control
    """
    # Access control check
    access_service = DealAccessService(db)
    authorized_deals = access_service.get_authorized_deals(current_user.ECode)
    
    authorized_deal_ids = {deal_info['deal'].ID for deal_info in authorized_deals}
    if deal_id not in authorized_deal_ids:
        raise HTTPException(status_code=403, detail="Access denied to this deal")
    
    deal = db.query(Deal).filter(Deal.ID == deal_id).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    
    deal.DisplayDeal = display_update.DisplayDeal
    db.commit()
    db.refresh(deal)
    
    display_status = "visible" if display_update.DisplayDeal else "hidden"
    return {
        "message": f"Deal display updated successfully", 
        "deal_id": deal_id, 
        "display_status": display_status
    }

@router.patch("/{deal_id}/temperature", response_model=DealResponse)
async def update_deal_temperature(
    deal_id: int = Path(..., description="The ID of the deal to update"),
    temperature_update: DealTemperatureUpdate = Body(..., description="The new temperature value"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update only the temperature of a specific deal with access control and automatic activity logging
    """
    # Access control check
    access_service = DealAccessService(db)
    authorized_deals = access_service.get_authorized_deals(current_user.ECode)
    
    authorized_deal_ids = {deal_info['deal'].ID for deal_info in authorized_deals}
    if deal_id not in authorized_deal_ids:
        raise HTTPException(status_code=403, detail="Access denied to this deal")
    
    deal = db.query(Deal).filter(Deal.ID == deal_id).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    
    # Check if user can edit (not subordinate deal)
    is_subordinate = any(
        deal_info['deal'].ID == deal_id and deal_info['is_subordinate'] 
        for deal_info in authorized_deals
    )
    
    if is_subordinate:
        raise HTTPException(status_code=403, detail="Cannot edit subordinate deals")
    
    try:
        # Store the old temperature before updating
        old_temperature = deal.Temperature.value if deal.Temperature else None
        new_temperature = temperature_update.Temperature.value
        
        # Only create activity log if temperature actually changed
        if old_temperature != new_temperature:
            # Update the deal temperature
            deal.Temperature = temperature_update.Temperature
            
            # Create activity log for temperature change
            create_temperature_change_log(
                db=db,
                deal_id=deal_id,
                user_ecode=current_user.ECode,
                temperature_from=old_temperature,
                temperature_to=new_temperature
            )
        
        db.commit()
        db.refresh(deal)
        
        updated_deal = db.query(Deal).options(
            joinedload(Deal.account),
            joinedload(Deal.salesperson),
            joinedload(Deal.contact),
            joinedload(Deal.lead_generator),
            joinedload(Deal.kam)
        ).filter(Deal.ID == deal_id).first()
        
        is_draggable = access_service.is_deal_draggable(updated_deal, current_user.ECode, False)
        
        return format_deal_response_with_access(updated_deal, is_draggable)
    
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error updating deal temperature: {str(e)}")

class DealSalespersonReassign(BaseModel):
    deal_ids: List[int]
    new_salesperson_ecode: str

@router.patch("/reassign-salesperson")
async def reassign_salesperson(
    reassign_data: DealSalespersonReassign = Body(..., description="Deal IDs and new salesperson ECode"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Reassign multiple deals to a new salesperson with access control and automatic activity logging
    """
    # Check permission to reassign deals
    permission_service = PermissionService(db)
    permission_service.require_permission(current_user, "deals", "reassign")
    
    # Validate new salesperson exists
    new_salesperson = db.query(User).filter(User.ECode == reassign_data.new_salesperson_ecode).first()
    if not new_salesperson:
        raise HTTPException(status_code=400, detail="New salesperson not found")
    
    # Access control check
    access_service = DealAccessService(db)
    authorized_deals = access_service.get_authorized_deals(current_user.ECode)
    authorized_deal_ids = {deal_info['deal'].ID for deal_info in authorized_deals}
    
    # Check if all requested deals are accessible
    inaccessible_deals = set(reassign_data.deal_ids) - authorized_deal_ids
    if inaccessible_deals:
        raise HTTPException(
            status_code=403, 
            detail=f"Access denied to deals: {list(inaccessible_deals)}"
        )
    
    try:
        reassigned_deals = []
        
        for deal_id in reassign_data.deal_ids:
            # Fetch deal with salesperson relationship
            deal = db.query(Deal).options(
                joinedload(Deal.salesperson)
            ).filter(Deal.ID == deal_id).first()
            
            if not deal:
                continue  # Skip if deal not found
            
            # Only reassign if different salesperson
            if deal.SalespersonECode != reassign_data.new_salesperson_ecode:
                old_salesperson_name = deal.salesperson.Name if deal.salesperson else "Unknown"
                
                # Update salesperson
                deal.SalespersonECode = reassign_data.new_salesperson_ecode
                v2_sync_service.sync_pipeline_deal(db, deal)
                
                # Create activity log
                create_salesperson_reassignment_log(
                    db=db,
                    deal_id=deal_id,
                    user_ecode=current_user.ECode,
                    old_salesperson_name=old_salesperson_name,
                    new_salesperson_name=new_salesperson.Name
                )
                
                reassigned_deals.append(deal_id)
        
        db.commit()
        
        return {
            "message": "Salesperson reassignment completed successfully",
            "reassigned_deals": reassigned_deals,
            "new_salesperson": {
                "ecode": new_salesperson.ECode,
                "name": new_salesperson.Name
            },
            "total_reassigned": len(reassigned_deals)
        }
    
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error reassigning salesperson: {str(e)}")

# New comprehensive deal edit model
class DealEditRequest(BaseModel):
    AccountID: Optional[int] = None
    SalespersonECode: Optional[str] = None
    ContactID: Optional[int] = None
    Division: Optional[str] = None
    ServiceType: Optional[str] = None
    DealValue: Optional[Decimal] = None
    ExpectedClosureDate: Optional[date] = None
    LeadGeneratedBy: Optional[str] = None
    LeadSource: Optional[str] = None
    Stage: Optional[str] = None
    Notes: Optional[str] = None
    KAMECode: Optional[str] = None

class DealEditResponse(BaseModel):
    message: str
    deal_id: int
    updated_fields: List[str]
    deal: DealResponse

@router.patch("/{deal_id}/admin-edit", response_model=DealEditResponse)
async def admin_edit_deal(
    deal_id: int = Path(..., description="The ID of the deal to edit"),
    edit_request: DealEditRequest = Body(..., description="Fields to update"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Comprehensive deal editing endpoint 
    Allows editing of any deal field with proper validation
    """
    # Check if user has edit deal permission
    permission_service = PermissionService(db)
    permission_service.require_permission(current_user, "deals", "edit")
    # Check if deal exists
    deal = db.query(Deal).filter(Deal.ID == deal_id).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    
    try:
        update_data = edit_request.dict(exclude_unset=True)
        
        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        updated_fields = []
        
        # Validate and update each field
        for field, value in update_data.items():
            if field == "AccountID" and value is not None:
                account = db.query(Account).filter(Account.id == value).first()
                if not account:
                    raise HTTPException(status_code=400, detail="Account not found")
                deal.AccountID = value
                updated_fields.append("AccountID")
            
            elif field == "SalespersonECode" and value is not None:
                salesperson = db.query(User).filter(User.ECode == value).first()
                if not salesperson:
                    raise HTTPException(status_code=400, detail="Salesperson not found")
                deal.SalespersonECode = value
                updated_fields.append("SalespersonECode")
            
            elif field == "ContactID" and value is not None:
                contact = db.query(Contact).filter(Contact.id == value).first()
                if not contact:
                    raise HTTPException(status_code=400, detail="Contact not found")
                deal.ContactID = value
                updated_fields.append("ContactID")
            
            elif field == "LeadGeneratedBy" and value is not None:
                lead_gen = db.query(User).filter(User.ECode == value).first()
                if not lead_gen:
                    raise HTTPException(status_code=400, detail="Lead Generator not found")
                deal.LeadGeneratedBy = value
                updated_fields.append("LeadGeneratedBy")
            
            elif field == "KAMECode" and value is not None:
                kam = db.query(User).filter(User.ECode == value).first()
                if not kam:
                    raise HTTPException(status_code=400, detail="KAM not found")
                deal.KAMECode = value
                updated_fields.append("KAMECode")
            
            elif field in ["Division", "ServiceType", "LeadSource", "Stage", "Notes"]:
                setattr(deal, field, value)
                updated_fields.append(field)
            
            elif field == "DealValue":
                deal.DealValue = value
                updated_fields.append("DealValue")
            
            elif field == "ExpectedClosureDate":
                deal.ExpectedClosureDate = value
                updated_fields.append("ExpectedClosureDate")
            
            elif field == "Status":
                deal.Status = value
                updated_fields.append("Status")
            
            elif field == "DisplayDeal":
                deal.DisplayDeal = value
                updated_fields.append("DisplayDeal")
            
            elif field == "Temperature":
                deal.Temperature = value
                updated_fields.append("Temperature")
            
            elif field == "Flag":
                deal.Flag = value
                updated_fields.append("Flag")
        v2_sync_service.sync_pipeline_deal(db, deal)
        db.commit()
        db.refresh(deal)
        
        # Fetch updated deal with all relationships
        updated_deal = db.query(Deal).options(
            joinedload(Deal.account),
            joinedload(Deal.salesperson),
            joinedload(Deal.contact),
            joinedload(Deal.lead_generator),
            joinedload(Deal.kam)
        ).filter(Deal.ID == deal_id).first()
        
        formatted_deal = format_deal_response_with_access(updated_deal, True)
        
        return DealEditResponse(
            message="Deal updated successfully",
            deal_id=deal_id,
            updated_fields=updated_fields,
            deal=formatted_deal
        )
    
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error updating deal: {str(e)}")

# Activity log CreatedAt edit models
class ActivityLogDateEdit(BaseModel):
    activity_log_id: int
    new_created_at: datetime

class ActivityLogDateEditRequest(BaseModel):
    date_edits: List[ActivityLogDateEdit]

class ActivityLogDateEditResponse(BaseModel):
    message: str
    deal_id: int
    updated_activity_logs: List[dict]
    total_updated: int

@router.patch("/{deal_id}/activity-logs/edit-dates", response_model=ActivityLogDateEditResponse)
async def edit_activity_log_dates(
    deal_id: int = Path(..., description="The ID of the deal whose activity logs to edit"),
    edit_request: ActivityLogDateEditRequest = Body(..., description="Activity log date edits"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Edit CreatedAt dates for activity logs of a specific deal - restricted to MD Office role only
    """
    # Check if user has MD Office role
    permission_service = PermissionService(db)
    permission_service.require_permission(current_user, "deals", "edit")
    
    # Check if deal exists
    deal = db.query(Deal).filter(Deal.ID == deal_id).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    
    try:
        updated_logs = []
        
        for date_edit in edit_request.date_edits:
            # Find the activity log
            activity_log = db.query(ActivityLog).filter(
                ActivityLog.ID == date_edit.activity_log_id,
                ActivityLog.DealID == deal_id  # Ensure the log belongs to the specified deal
            ).first()
            
            if not activity_log:
                continue
            
            old_date = activity_log.CreatedAt
            activity_log.CreatedAt = date_edit.new_created_at
            
            updated_logs.append({
                "activity_log_id": date_edit.activity_log_id,
                "old_created_at": old_date,
                "new_created_at": date_edit.new_created_at,
                "action": activity_log.Action
            })
        
        db.commit()
        
        return ActivityLogDateEditResponse(
            message="Activity log dates updated successfully",
            deal_id=deal_id,
            updated_activity_logs=updated_logs,
            total_updated=len(updated_logs)
        )

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error updating activity log dates: {str(e)}")

@router.post("/{deal_id}/notes", response_model=NoteResponse)
async def create_note(
    deal_id: int, 
    note_data: NoteCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    deal = db.query(Deal).filter(Deal.ID == deal_id).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")

    note = Note(
        ECode = current_user.ECode,
        DealID = deal_id,
        Notes = note_data.Notes
    )

    db.add(note)
    db.commit()
    db.refresh(note)

    return NoteResponse(
        ID=note.ID,
        ECode=note.ECode,
        DealID=note.DealID,
        Notes=note.Notes,
    )

@router.put("/{deal_id}/notes", response_model=NoteResponse)
async def edit_note_on_deal(
    deal_id: int,
    note_data: NoteUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    note = db.query(Note).filter(Note.DealID == deal_id, Note.ECode == current_user.ECode).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found for this deal and user")

    if note_data.Notes is not None:
        note.Notes = note_data.Notes

    db.commit()
    db.refresh(note)

    return NoteResponse(
        ID=note.ID,
        ECode=note.ECode,
        DealID=note.DealID,
        Notes=note.Notes,
    )

@router.get("/{deal_id}/notes", response_model=NoteResponse)
async def get_note_for_deal(
    deal_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    note = db.query(Note).filter(Note.DealID == deal_id, Note.ECode == current_user.ECode).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found for this deal and user")

    return NoteResponse(
        ID=note.ID,
        ECode=note.ECode,
        DealID=note.DealID,
        Notes=note.Notes,
    )
