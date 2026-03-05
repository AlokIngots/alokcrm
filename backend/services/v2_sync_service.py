from __future__ import annotations

from datetime import date
from typing import Optional

from sqlalchemy import inspect
from sqlalchemy.orm import Session

from database.tables.accounts import Account
from database.tables.contacts import Contact
from database.tables.deals import Deal
from database.tables.enquiries import Enquiry, EnquiryItem
from database.tables.products import Product
from database.tables.users import User
from database.tables.alok_v2 import (
    V2Account,
    V2Contact,
    V2Enquiry,
    V2EnquiryItem,
    V2PipelineDeal,
    V2PipelineStageHistory,
    V2User,
)
from services.business_rules import normalize_sale_type as normalize_sale_type_rule
from services.business_rules import normalize_v2_stage


def normalize_role(role: Optional[str]) -> str:
    value = (role or "").strip().lower()
    if value in {"admin", "super admin", "md office"}:
        return "admin"
    if value in {"manager", "sales coordinator", "sales_coordinator"}:
        return "sales_coordinator"
    return "sales"


def normalize_sale_type(value: Optional[str]) -> str:
    return normalize_sale_type_rule(value)


def normalize_enquiry_status(value: Optional[str]) -> str:
    raw = (value or "").strip().upper()
    if raw in {"NEW"}:
        return "NEW"
    if raw in {"CONVERTED", "CLOSED", "DEAL_WON", "DEAL_LOST", "WON", "LOST"}:
        return "CLOSED"
    return "IN_PIPELINE"


def normalize_stage(value: Optional[str]) -> str:
    return normalize_v2_stage(value)


def _has_table_columns(db: Session, table_name: str, required_columns: set[str]) -> bool:
    inspector = inspect(db.bind)
    if not inspector.has_table(table_name):
        return False
    cols = {c["name"] for c in inspector.get_columns(table_name)}
    return required_columns.issubset(cols)


def is_v2_schema_available(db: Session) -> bool:
    # Guard for legacy schemas; activate only when namespaced v2 tables exist.
    return (
        _has_table_columns(db, "v2_users", {"ecode", "name", "role", "is_active"})
        and _has_table_columns(db, "v2_accounts", {"id", "name", "sale_type", "is_blacklisted"})
        and _has_table_columns(db, "v2_pipeline_deals", {"id", "stage", "sale_type"})
    )


def sync_user(db: Session, user: User) -> None:
    if not is_v2_schema_available(db):
        return
    obj = db.query(V2User).filter(V2User.ecode == user.ECode).first()
    if not obj:
        obj = V2User(ecode=user.ECode)
        db.add(obj)
    obj.name = user.Name
    obj.role = normalize_role(user.Role)
    obj.phone = user.PhoneNumber
    obj.is_active = True


def deactivate_user(db: Session, ecode: str) -> None:
    if not is_v2_schema_available(db):
        return
    obj = db.query(V2User).filter(V2User.ecode == ecode).first()
    if obj:
        obj.is_active = False


def sync_account(db: Session, account: Account) -> None:
    if not is_v2_schema_available(db):
        return
    obj = db.query(V2Account).filter(V2Account.id == account.id).first()
    if not obj:
        obj = V2Account(id=account.id)
        db.add(obj)
    obj.name = account.Name
    obj.industry = account.Industry
    obj.sale_type = normalize_sale_type(account.Division)
    obj.location = account.Location
    obj.website = account.Website
    obj.turnover = account.Turnover
    obj.notes = account.Notes
    obj.is_blacklisted = bool(account.blacklist)


def delete_account(db: Session, account_id: int) -> None:
    if not is_v2_schema_available(db):
        return
    db.query(V2Account).filter(V2Account.id == account_id).delete()


def sync_contact(db: Session, contact: Contact) -> None:
    if not is_v2_schema_available(db):
        return
    obj = db.query(V2Contact).filter(V2Contact.id == contact.id).first()
    if not obj:
        obj = V2Contact(id=contact.id)
        db.add(obj)
    obj.account_id = contact.AccountID
    obj.name = contact.Name
    obj.designation = contact.Designation
    obj.email_1 = contact.Email1
    obj.email_2 = contact.Email2
    obj.phone_1 = contact.Phone1
    obj.phone_2 = contact.Phone2
    obj.notes = contact.Notes


def delete_contact(db: Session, contact_id: int) -> None:
    if not is_v2_schema_available(db):
        return
    db.query(V2Contact).filter(V2Contact.id == contact_id).delete()


def sync_enquiry(db: Session, enquiry: Enquiry, sale_type_hint: Optional[str] = None, offer_no: Optional[str] = None) -> None:
    if not is_v2_schema_available(db):
        return
    obj = db.query(V2Enquiry).filter(V2Enquiry.id == enquiry.id).first()
    if not obj:
        obj = V2Enquiry(id=enquiry.id)
        db.add(obj)

    sale_type = normalize_sale_type(sale_type_hint)
    if not sale_type_hint:
        account = db.query(Account).filter(Account.id == enquiry.AccountID).first()
        sale_type = normalize_sale_type(account.Division if account else None)

    obj.account_id = enquiry.AccountID
    obj.contact_id = enquiry.ContactID
    obj.owner_ecode = enquiry.OwnerECode
    obj.sale_type = sale_type
    obj.offer_no = offer_no
    obj.enquiry_date = enquiry.CreatedAt.date() if enquiry.CreatedAt else None
    obj.status = normalize_enquiry_status(enquiry.Status)
    obj.source = enquiry.Source
    obj.business_type = enquiry.BusinessType
    obj.tech_notes = enquiry.TechNotes


def sync_enquiry_items(db: Session, enquiry_id: int) -> None:
    if not is_v2_schema_available(db):
        return
    # Keep v2 enquiry item state in sync with v1 for reliable export/template rendering.
    db.query(V2EnquiryItem).filter(V2EnquiryItem.enquiry_id == enquiry_id).delete()
    source_items = db.query(EnquiryItem).filter(EnquiryItem.EnquiryID == enquiry_id).all()

    for row in source_items:
        product_name = None
        if row.ProductID:
            product = db.query(Product).filter(Product.id == row.ProductID).first()
            product_name = product.Name if product else None
        db.add(
            V2EnquiryItem(
                id=row.id,
                enquiry_id=row.EnquiryID,
                product=product_name,
                grade=row.Grade,
                shape=row.Shape,
                size_mm=row.Dia,
                qty=row.Qty,
                tolerance=row.Tolerance,
                notes=row.Notes or row.Application,
            )
        )


def _guess_related_enquiry_id(db: Session, deal: Deal) -> Optional[int]:
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
    return enquiry.id if enquiry else None


def sync_pipeline_deal(db: Session, deal: Deal, enquiry_id: Optional[int] = None) -> None:
    if not is_v2_schema_available(db):
        return
    obj = db.query(V2PipelineDeal).filter(V2PipelineDeal.id == deal.ID).first()
    if not obj:
        obj = V2PipelineDeal(id=deal.ID)
        db.add(obj)
    obj.enquiry_id = enquiry_id or _guess_related_enquiry_id(db, deal)
    obj.account_id = deal.AccountID
    obj.contact_id = deal.ContactID
    obj.salesperson_ecode = deal.SalespersonECode
    obj.sale_type = normalize_sale_type(deal.Division)
    obj.stage = normalize_stage(deal.Stage)
    obj.deal_value = deal.DealValue
    obj.expected_closure_date = deal.ExpectedClosureDate


def sync_deal_stage_history(
    db: Session,
    deal_id: int,
    from_stage: Optional[str],
    to_stage: str,
    changed_by_ecode: str,
    reason: Optional[str] = None,
) -> None:
    if not is_v2_schema_available(db):
        return
    db.add(
        V2PipelineStageHistory(
            deal_id=deal_id,
            from_stage=normalize_stage(from_stage),
            to_stage=normalize_stage(to_stage),
            changed_by_ecode=changed_by_ecode,
            change_reason=reason,
        )
    )


def ensure_v2_offer_for_deal(
    db: Session,
    deal_id: int,
    offer_number: str,
    created_by_ecode: str,
    offer_date: Optional[date] = None,
    payment_terms: Optional[str] = None,
    delivery_days: Optional[str] = None,
) -> None:
    if not is_v2_schema_available(db):
        return
    from database.tables.alok_v2 import V2Offer

    obj = db.query(V2Offer).filter(V2Offer.deal_id == deal_id).first()
    if not obj:
        obj = V2Offer(
            deal_id=deal_id,
            offer_number=offer_number,
            created_by_ecode=created_by_ecode,
            offer_date=offer_date or date.today(),
        )
        db.add(obj)
    else:
        obj.offer_number = offer_number
        obj.created_by_ecode = created_by_ecode
        obj.offer_date = offer_date or obj.offer_date or date.today()
    obj.payment_terms = payment_terms
    obj.delivery_days = delivery_days
