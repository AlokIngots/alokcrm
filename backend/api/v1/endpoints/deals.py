from fastapi import APIRouter, Depends, HTTPException, Path, Body
from fastapi.responses import Response
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from datetime import date, datetime, timedelta
from decimal import Decimal
import html
import re
import base64
import io
import logging
from pathlib import Path as FilePath
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Table, TableStyle, Paragraph
from reportlab.pdfgen import canvas

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
from services.quotation_service import send_quotation_email

router = APIRouter()
logger = logging.getLogger("crm.offer")


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


def _get_offer_logo_path() -> Optional[FilePath]:
    repo_root = FilePath(__file__).resolve().parents[4]
    candidates = [
        repo_root / "frontend" / "public" / "images" / "Alok_logo.png",
        repo_root / "frontend" / "public" / "images" / "logo.png",
    ]
    for path in candidates:
        if path.exists():
            return path
    return None


def _extract_note_value(notes: Optional[str], prefix: str) -> Optional[str]:
    if not notes:
        return None
    for raw in notes.splitlines():
        line = raw.strip()
        if line.lower().startswith(prefix.lower()):
            return line.split(":", 1)[1].strip() if ":" in line else None
    return None


def _extract_note_value_flexible(notes: Optional[str], *prefixes: str) -> Optional[str]:
    if not notes:
        return None

    lines = [line.strip() for line in notes.splitlines() if line.strip()]
    for prefix in prefixes:
        for line in lines:
            if line.lower().startswith(prefix.lower()):
                return line.split(":", 1)[1].strip() if ":" in line else None

    full_text = "\n".join(lines)
    for prefix in prefixes:
        pattern = re.compile(rf"{re.escape(prefix)}\s*:\s*([^;\n]+)", re.IGNORECASE)
        match = pattern.search(full_text)
        if match:
            return match.group(1).strip()

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
    if not product_lines:
        in_items = False
        stop_markers = re.compile(
            r"^(offer\s*(no|number)|sale type|order progress|commercial|delivery|payment(\s*terms)?|enquiry id)\s*:",
            re.IGNORECASE,
        )
        for line in lines:
            if re.match(r"^items\s*:?", line, re.IGNORECASE):
                in_items = True
                continue
            if not in_items:
                continue
            if stop_markers.match(line):
                break
            if "|" in line or re.match(r"^\d+\.\s*", line):
                product_lines.append(line)

    parsed = []

    for idx, line in enumerate(product_lines, start=1):
        clean = re.sub(r"^\d+\.\s*", "", line)
        pipe_parts = [p.strip() for p in clean.split("|") if p.strip()]
        parts = [p.strip() for p in re.split(r"[|;]", clean) if p.strip()]

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

        if len(pipe_parts) >= 2 and ":" not in pipe_parts[0] and ":" not in pipe_parts[1]:
            row["grade"] = pipe_parts[0]
            row["product"] = pipe_parts[1]
        elif len(pipe_parts) > 0:
            row["product"] = pipe_parts[0]
        if len(pipe_parts) > 2 and ":" not in pipe_parts[2] and not row["grade"]:
            row["grade"] = pipe_parts[2]
        if len(pipe_parts) > 3 and ":" not in pipe_parts[3]:
            row["size"] = pipe_parts[3].replace("mm", " mm").strip()

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
            elif l.startswith("grade:"):
                row["grade"] = p.split(":", 1)[1].strip()
            elif l.startswith("product:"):
                row["product"] = p.split(":", 1)[1].strip()
            elif l.startswith("size:"):
                row["size"] = p.split(":", 1)[1].strip()
            elif "dia:" in l and not row["size"]:
                row["size"] = p.split(":", 1)[1].strip()

        parsed.append(row)

    return parsed


def _render_offer_letter_html(deal: Deal) -> str:
    customer = deal.account.Name if deal.account else "Customer"
    offer_no = _extract_note_value_flexible(deal.Notes, "Offer No", "Offer Number") or _build_default_offer_no(deal)
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
    payment_terms = _extract_note_value_flexible(deal.Notes, "Payment Terms", "Payment") or "-"
    delivery_days = _extract_note_value_flexible(deal.Notes, "Delivery") or "-"
    validity = "4 Days"
    salesperson = deal.salesperson.Name if deal.salesperson else "-"
    contact_person = deal.contact.Name if deal.contact else "-"

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
        @page {{ size: A4; margin: 16mm 12mm; }}
        body {{ font-family: 'Segoe UI', Arial, sans-serif; margin: 0; color: #111827; background: #fff; }}
        .sheet {{ max-width: 210mm; margin: 0 auto; }}
        .header {{ display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 8px; }}
        .logo {{ height: 64px; width: auto; object-fit: contain; }}
        .logo-fallback {{ font-size: 28px; font-weight: 800; letter-spacing: 1px; }}
        .header-right {{ text-align: right; font-size: 12px; color: #4b5563; }}
        .company-line {{ border-top: 2px solid #e57f36; margin: 8px 0 12px; }}
        .topmeta {{ display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; }}
        .cert {{ font-size: 12px; color: #374151; letter-spacing: 0.3px; }}
        .date {{ font-size: 24px; font-weight: 800; }}
        .meta {{ margin-bottom: 12px; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 12px; background: #fafafa; }}
        .meta p {{ margin: 4px 0; font-size: 13px; }}
        .meta .k {{ display:inline-block; min-width: 150px; font-weight: 700; color: #111827; }}
        .meta .v {{ font-weight: 700; font-size: 15px; letter-spacing: 0.2px; }}
        table {{ width:100%; border-collapse: collapse; margin-top:8px; }}
        th, td {{ border:1px solid #9ca3af; padding:6px 5px; font-size:11px; text-align:center; vertical-align:middle; }}
        th {{ background:#eef2ff; font-weight: 700; }}
        td:nth-child(4), td:nth-child(5), td:nth-child(6), td:nth-child(7), td:nth-child(8), td:nth-child(9) {{ font-size: 11px; }}
        .terms {{ margin-top: 14px; max-width: 520px; border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px 12px; background: #fafafa; }}
        .terms-row {{ display:flex; align-items:flex-start; margin: 4px 0; font-size: 13px; }}
        .terms-k {{ width: 140px; font-weight: 700; }}
        .terms-v {{ font-weight: 600; }}
        .sign {{ margin-top: 20px; display:flex; justify-content:flex-end; }}
        .sign-box {{ min-width: 220px; text-align:center; }}
        .sign-line {{ margin-top: 30px; border-top: 1px solid #6b7280; padding-top: 4px; font-size: 11px; color: #4b5563; }}
        .footer {{ margin-top: 16px; border-top: 2px solid #e57f36; padding-top: 8px; font-size: 10px; color:#1f2937; display:flex; justify-content:space-between; gap: 20px; }}
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
        <p><span class="k">CONTACT PERSON</span>: <span class="v">{html.escape(contact_person)}</span></p>
        <p><span class="k">SALESPERSON</span>: <span class="v">{html.escape(salesperson)}</span></p>
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
      <div class="sign">
        <div class="sign-box">
          <div class="sign-line">Authorized Signatory</div>
        </div>
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


def _render_offer_letter_pdf(deal: Deal) -> bytes:
    customer = deal.account.Name if deal.account else "Customer"
    offer_no = _extract_note_value_flexible(deal.Notes, "Offer No", "Offer Number") or _build_default_offer_no(deal)
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

    payment_terms = _extract_note_value_flexible(deal.Notes, "Payment Terms", "Payment") or "-"
    delivery_days = _extract_note_value_flexible(deal.Notes, "Delivery") or "-"
    validity_raw = _extract_note_value_flexible(deal.Notes, "Offer Validity Date", "Validity Date", "Validity")
    offer_date = datetime.now().date()
    validity_days = 4
    if validity_raw and validity_raw.isdigit():
        validity_days = max(int(validity_raw), 1)
    validity_date = offer_date + timedelta(days=validity_days)
    offer_date_text = offer_date.strftime("%d-%m-%Y")
    validity_date_text = validity_date.strftime("%d-%m-%Y")
    if validity_raw and not validity_raw.isdigit():
        validity_date_text = validity_raw

    salesperson = deal.salesperson.Name if deal.salesperson else "-"
    contact_person = deal.contact.Name if deal.contact else "-"
    deal_value_text = f"Rs {deal.DealValue:,.2f}" if deal.DealValue is not None else "-"
    expected_closure_text = (
        deal.ExpectedClosureDate.strftime("%d-%m-%Y")
        if deal.ExpectedClosureDate
        else "-"
    )

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    width, height = A4
    left = 14 * mm
    right = width - (14 * mm)
    content_width = right - left
    y = height - (14 * mm)

    logo_path = _get_offer_logo_path()
    if logo_path:
        c.drawImage(str(logo_path), left, y - 15 * mm, width=42 * mm, height=13 * mm, preserveAspectRatio=True, mask="auto")

    c.setFillColor(colors.HexColor("#374151"))
    c.setFont("Helvetica-Bold", 10)
    c.drawRightString(right, y - 3 * mm, "ISO 9001:2015 Certified")
    c.setFillColor(colors.HexColor("#111827"))
    c.setFont("Helvetica-Bold", 20)
    c.drawRightString(right, y - 11 * mm, "Sales Offer")
    y -= 20 * mm

    c.setStrokeColor(colors.HexColor("#e57f36"))
    c.setLineWidth(1.4)
    c.line(left, y, right, y)
    y -= 7 * mm

    def _draw_section_title(title: str, top_y: float) -> float:
        c.setFillColor(colors.HexColor("#111827"))
        c.setFont("Helvetica-Bold", 11)
        c.drawString(left, top_y, title)
        return top_y - 5 * mm

    def _draw_key_value_table(rows: list[list[str]], top_y: float) -> float:
        t = Table(rows, colWidths=[44 * mm, content_width - 44 * mm])
        t.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
            ("FONTNAME", (1, 0), (1, -1), "Helvetica"),
            ("FONTSIZE", (0, 0), (-1, -1), 10),
            ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#111827")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("ALIGN", (0, 0), (0, -1), "LEFT"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 1),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ]))
        _, th = t.wrap(content_width, 0)
        t.drawOn(c, left, top_y - th)
        return top_y - th - 4 * mm

    y = _draw_section_title("Offer Information", y)
    y = _draw_key_value_table([
        ["Offer Number", str(offer_no)],
        ["Offer Date", offer_date_text],
        ["Offer Validity Date", validity_date_text],
    ], y)

    y = _draw_section_title("Customer Details", y)
    y = _draw_key_value_table([
        ["Customer Name", customer],
        ["Product / Service", deal.ServiceType or "-"],
        ["Division", deal.Division or "-"],
        ["Deal Value", deal_value_text],
        ["Lead Source", deal.LeadSource or "-"],
        ["Expected Closure Date", expected_closure_text],
        ["Salesperson Name", salesperson],
        ["Contact Person", contact_person],
    ], y)

    headers = ["Sr", "Grade", "Product", "Size", "Qty", "HT", "TOL", "Length", "Rate"]
    rows = [headers]
    styles = getSampleStyleSheet()
    cell_style = styles["BodyText"]
    cell_style.fontName = "Helvetica"
    cell_style.fontSize = 8
    cell_style.leading = 9
    cell_style.wordWrap = "CJK"

    def _cell_text(value: str) -> Paragraph:
        safe = html.escape((value or "-").replace(",", ", "))
        return Paragraph(safe, cell_style)

    for row in product_rows:
        rows.append([
            str(row.get("sr_no", "")),
            _cell_text(str(row.get("grade", "") or "-")),
            _cell_text(str(row.get("product", "") or "-")),
            _cell_text(str(row.get("size", "") or "-")),
            _cell_text(str(row.get("qty", "") or "-")),
            _cell_text(str(row.get("ht", "") or "-")),
            _cell_text(str(row.get("tol", "") or "-")),
            _cell_text(str(row.get("length", "") or "-")),
            _cell_text(str(row.get("rate", "") or "-")),
        ])

    product_table = Table(
        rows,
        colWidths=[10 * mm, 18 * mm, 34 * mm, 26 * mm, 14 * mm, 14 * mm, 14 * mm, 19 * mm, 17 * mm],
        repeatRows=1,
    )
    product_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f3f4f6")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#111827")),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 8.5),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 3),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#9ca3af")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#fafafa")]),
    ]))
    _, pth = product_table.wrap(content_width, 0)
    product_table.drawOn(c, left, y - pth)
    y -= pth + 7 * mm

    y = _draw_section_title("Commercial Terms", y)
    y = _draw_key_value_table([
        ["Validity", f"{validity_days} Days"],
        ["Delivery Days", str(delivery_days)],
        ["Payment Terms", str(payment_terms)],
    ], y)

    c.setFillColor(colors.HexColor("#111827"))
    c.setFont("Helvetica", 10)
    c.drawRightString(right, 30 * mm, "For Alok Ingots (Mumbai) Pvt Ltd")
    c.line(right - 62 * mm, 24 * mm, right, 24 * mm)
    c.drawRightString(right, 20 * mm, "Authorized Signatory")

    c.setStrokeColor(colors.HexColor("#e57f36"))
    c.setLineWidth(1.1)
    c.line(left, 16 * mm, right, 16 * mm)
    c.setFont("Helvetica", 8)
    c.setFillColor(colors.HexColor("#374151"))
    c.drawString(left, 12 * mm, "ALOK INGOTS (MUMBAI) PVT LTD | Nariman Point, Mumbai | +91 22 4022008")
    c.drawRightString(right, 12 * mm, "Manufacturing Unit: Wada, Palghar")

    c.showPage()
    c.save()
    return buf.getvalue()


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


def _resolve_quotation_recipient_email(db: Session, deal: Deal) -> Optional[str]:
    """
    Prefer customer email from the most relevant enquiry contact.
    Fallback to deal contact email.
    """
    enquiry = (
        db.query(Enquiry)
        .options(joinedload(Enquiry.contact))
        .filter(
            Enquiry.AccountID == deal.AccountID,
            Enquiry.ContactID == deal.ContactID,
            Enquiry.OwnerECode == deal.SalespersonECode,
        )
        .order_by(Enquiry.id.desc())
        .first()
    )
    if enquiry and enquiry.contact:
        if enquiry.contact.Email1:
            return enquiry.contact.Email1
        if enquiry.contact.Email2:
            return enquiry.contact.Email2

    if deal.contact:
        if deal.contact.Email1:
            return deal.contact.Email1
        if deal.contact.Email2:
            return deal.contact.Email2

    return None

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
    Download offer letter for a deal as a PDF file.
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

    offer_pdf = _render_offer_letter_pdf(deal)
    filename = f"offer-letter-{deal_id}.pdf"
    return Response(
        content=offer_pdf,
        media_type="application/pdf",
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
        should_send_quotation = False
        
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
                offer_no = _extract_note_value_flexible(deal.Notes, "Offer No", "Offer Number") or _build_default_offer_no(deal)
                payment_terms = _extract_note_value_flexible(deal.Notes, "Payment Terms", "Payment")
                delivery_days = _extract_note_value_flexible(deal.Notes, "Delivery")
                v2_sync_service.ensure_v2_offer_for_deal(
                    db=db,
                    deal_id=deal.ID,
                    offer_number=offer_no,
                    created_by_ecode=current_user.ECode,
                    payment_terms=payment_terms,
                    delivery_days=delivery_days,
                )
                should_send_quotation = True
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

        recipient_email = _resolve_quotation_recipient_email(db, updated_deal) if updated_deal else None
        if should_send_quotation and updated_deal:
            if recipient_email:
                offer_no = _extract_note_value_flexible(updated_deal.Notes, "Offer No", "Offer Number") or _build_default_offer_no(updated_deal)
                pdf_bytes = _render_offer_letter_pdf(updated_deal)
                filename = f"sales-offer-{updated_deal.ID}.pdf"
                sent, reason = send_quotation_email(
                    to_email=recipient_email,
                    customer_name=updated_deal.account.Name if updated_deal.account else "Customer",
                    offer_number=offer_no,
                    salesperson_name=updated_deal.salesperson.Name if updated_deal.salesperson else "-",
                    pdf_bytes=pdf_bytes,
                    filename=filename,
                )
                logger.info(
                    "quotation_auto_send deal_id=%s email=%s sent=%s reason=%s",
                    updated_deal.ID,
                    recipient_email,
                    sent,
                    reason,
                )
                action = (
                    f"quotation email sent to {recipient_email}"
                    if sent
                    else f"quotation email failed to {recipient_email} ({reason})"
                )
            else:
                action = "quotation email skipped (no customer email found in enquiry/contact)"

            db.add(
                ActivityLog(
                    DealID=updated_deal.ID,
                    ECode=current_user.ECode,
                    Action=action,
                )
            )
            db.commit()
        
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
