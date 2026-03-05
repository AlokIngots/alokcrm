from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
)

from database.db import Base


class V2User(Base):
    __tablename__ = "v2_users"

    ecode = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    role = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint("role IN ('admin','sales_coordinator','sales')", name="ck_users_role"),
    )


class V2Account(Base):
    __tablename__ = "v2_accounts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    industry = Column(String, nullable=True)
    sale_type = Column(String, nullable=False)
    location = Column(String, nullable=True)
    website = Column(String, nullable=True)
    turnover = Column(Numeric(18, 2), nullable=True)
    notes = Column(Text, nullable=True)
    is_blacklisted = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint("sale_type IN ('LOCAL','EXPORT')", name="ck_accounts_sale_type"),
    )


class V2Contact(Base):
    __tablename__ = "v2_contacts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    account_id = Column(Integer, ForeignKey("v2_accounts.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    designation = Column(String, nullable=True)
    email_1 = Column(String, nullable=True)
    email_2 = Column(String, nullable=True)
    phone_1 = Column(String, nullable=True)
    phone_2 = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


class V2Enquiry(Base):
    __tablename__ = "v2_enquiries"

    id = Column(Integer, primary_key=True, autoincrement=True)
    account_id = Column(Integer, ForeignKey("v2_accounts.id", ondelete="RESTRICT"), nullable=False)
    contact_id = Column(Integer, ForeignKey("v2_contacts.id", ondelete="SET NULL"), nullable=True)
    owner_ecode = Column(String, ForeignKey("v2_users.ecode", ondelete="RESTRICT"), nullable=False)
    sale_type = Column(String, nullable=False)
    offer_no = Column(String, nullable=True)
    enquiry_date = Column(Date, nullable=True)
    status = Column(String, nullable=False, default="NEW")
    source = Column(String, nullable=True)
    business_type = Column(String, nullable=True)
    tech_notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint("sale_type IN ('LOCAL','EXPORT')", name="ck_enquiries_sale_type"),
        CheckConstraint("status IN ('NEW','IN_PIPELINE','CLOSED')", name="ck_enquiries_status"),
    )


class V2EnquiryItem(Base):
    __tablename__ = "v2_enquiry_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    enquiry_id = Column(Integer, ForeignKey("v2_enquiries.id", ondelete="CASCADE"), nullable=False)
    product = Column(String, nullable=True)
    grade = Column(String, nullable=True)
    shape = Column(String, nullable=True)
    size_mm = Column(String, nullable=True)
    length_mm = Column(String, nullable=True)
    heat_treatment = Column(String, nullable=True)
    tolerance = Column(String, nullable=True)
    chamfering = Column(String, nullable=True)
    qty = Column(String, nullable=True)
    uom = Column(String, nullable=True)
    ultrasonic_test = Column(String, nullable=True)
    price_offer = Column(Numeric(18, 4), nullable=True)
    price_uom = Column(String, nullable=True)
    notes = Column(Text, nullable=True)


class V2PipelineDeal(Base):
    __tablename__ = "v2_pipeline_deals"

    id = Column(Integer, primary_key=True, autoincrement=True)
    enquiry_id = Column(Integer, ForeignKey("v2_enquiries.id", ondelete="CASCADE"), unique=True, nullable=True)
    account_id = Column(Integer, ForeignKey("v2_accounts.id", ondelete="RESTRICT"), nullable=False)
    contact_id = Column(Integer, ForeignKey("v2_contacts.id", ondelete="SET NULL"), nullable=True)
    salesperson_ecode = Column(String, ForeignKey("v2_users.ecode", ondelete="RESTRICT"), nullable=False)
    sale_type = Column(String, nullable=False)
    stage = Column(String, nullable=False)
    deal_value = Column(Numeric(18, 2), nullable=True, default=0)
    expected_closure_date = Column(Date, nullable=True)
    loss_reason = Column(Text, nullable=True)
    won_notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint("sale_type IN ('LOCAL','EXPORT')", name="ck_pipeline_deals_sale_type"),
        CheckConstraint(
            "stage IN ('ENQUIRY','FEASIBILITY','OFFER','ORDER_WON','ORDER_LOST')",
            name="ck_pipeline_deals_stage",
        ),
    )


class V2PipelineStageHistory(Base):
    __tablename__ = "v2_pipeline_stage_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    deal_id = Column(Integer, ForeignKey("v2_pipeline_deals.id", ondelete="CASCADE"), nullable=False)
    from_stage = Column(String, nullable=True)
    to_stage = Column(String, nullable=False)
    changed_by_ecode = Column(String, ForeignKey("v2_users.ecode", ondelete="RESTRICT"), nullable=False)
    change_reason = Column(Text, nullable=True)
    changed_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class V2Offer(Base):
    __tablename__ = "v2_offers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    deal_id = Column(Integer, ForeignKey("v2_pipeline_deals.id", ondelete="CASCADE"), unique=True, nullable=False)
    offer_number = Column(String, unique=True, nullable=False)
    offer_date = Column(Date, nullable=False)
    validity_days = Column(Integer, nullable=True)
    delivery_days = Column(String, nullable=True)
    payment_terms = Column(Text, nullable=True)
    html_snapshot = Column(Text, nullable=True)
    created_by_ecode = Column(String, ForeignKey("v2_users.ecode", ondelete="RESTRICT"), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class V2SalesTarget(Base):
    __tablename__ = "v2_sales_targets"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ecode = Column(String, ForeignKey("v2_users.ecode", ondelete="CASCADE"), nullable=False)
    fy = Column(String, nullable=False)
    month = Column(String, nullable=False)
    target_value = Column(Numeric(18, 2), nullable=True, default=0)


class V2SalesActual(Base):
    __tablename__ = "v2_sales_actuals"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ecode = Column(String, ForeignKey("v2_users.ecode", ondelete="CASCADE"), nullable=False)
    fy = Column(String, nullable=False)
    month = Column(String, nullable=False)
    actual_value = Column(Numeric(18, 2), nullable=True, default=0)
    qualified_value = Column(Numeric(18, 2), nullable=True, default=0)


class V2RolePermission(Base):
    __tablename__ = "v2_role_permissions"

    role = Column(String, primary_key=True)
    enquiries_create = Column(Boolean, nullable=False, default=False)
    enquiries_edit = Column(Boolean, nullable=False, default=False)
    pipeline_move = Column(Boolean, nullable=False, default=False)
    offers_generate = Column(Boolean, nullable=False, default=False)
    users_manage = Column(Boolean, nullable=False, default=False)
    accounts_manage = Column(Boolean, nullable=False, default=False)
    reports_view_all = Column(Boolean, nullable=False, default=False)
