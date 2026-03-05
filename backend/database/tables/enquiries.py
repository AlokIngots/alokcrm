from sqlalchemy import Column, Integer, String, Date, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from database.db import Base
from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime


class Enquiry(Base):
    __tablename__ = "Enquiries"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    AccountID = Column(Integer, ForeignKey("Accounts.id"), nullable=False)
    ContactID = Column(Integer, ForeignKey("Contacts.id"), nullable=True)
    OwnerECode = Column(String(10), ForeignKey("Users.ECode"), nullable=False)
    Source = Column(String(100))
    BusinessType = Column(String(100))
    Industry = Column(String(100))
    Status = Column(String(50), default="NEW")
    NextFollowupDate = Column(Date, nullable=True)
    FeasibilityStatus = Column(String(20), default="PENDING")
    TechNotes = Column(Text, nullable=True)
    CreatedAt = Column(DateTime, default=datetime.utcnow)
    UpdatedAt = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    account = relationship("Account")
    contact = relationship("Contact")
    owner = relationship("User", foreign_keys=[OwnerECode])
    items = relationship("EnquiryItem", back_populates="enquiry", cascade="all, delete-orphan")


class EnquiryItem(Base):
    __tablename__ = "EnquiryItems"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    EnquiryID = Column(Integer, ForeignKey("Enquiries.id"), nullable=False)
    ProductID = Column(Integer, ForeignKey("Products.id"), nullable=True)
    Grade = Column(String(100), nullable=True)
    Shape = Column(String(100), nullable=True)
    Dia = Column(String(50), nullable=True)
    Qty = Column(String(50), nullable=True)
    Tolerance = Column(String(100), nullable=True)
    Application = Column(String(255), nullable=True)
    Notes = Column(Text, nullable=True)

    enquiry = relationship("Enquiry", back_populates="items")
    product = relationship("Product")


class EnquiryItemBase(BaseModel):
    ProductID: Optional[int] = None
    Grade: Optional[str] = None
    Shape: Optional[str] = None
    Dia: Optional[str] = None
    Qty: Optional[str] = None
    Tolerance: Optional[str] = None
    Application: Optional[str] = None
    Notes: Optional[str] = None


class EnquiryItemCreate(EnquiryItemBase):
    pass


class EnquiryItemResponse(EnquiryItemBase):
    id: int
    EnquiryID: int

    class Config:
        from_attributes = True


class EnquiryBase(BaseModel):
    AccountID: int
    ContactID: Optional[int] = None
    OwnerECode: str
    Source: Optional[str] = None
    BusinessType: Optional[str] = None
    Industry: Optional[str] = None
    Status: Optional[str] = "NEW"
    NextFollowupDate: Optional[date] = None
    FeasibilityStatus: Optional[str] = "PENDING"
    TechNotes: Optional[str] = None


class EnquiryCreate(EnquiryBase):
    Items: List[EnquiryItemCreate] = []


class EnquiryUpdate(BaseModel):
    AccountID: Optional[int] = None
    ContactID: Optional[int] = None
    OwnerECode: Optional[str] = None
    Source: Optional[str] = None
    BusinessType: Optional[str] = None
    Industry: Optional[str] = None
    Status: Optional[str] = None
    NextFollowupDate: Optional[date] = None
    FeasibilityStatus: Optional[str] = None
    TechNotes: Optional[str] = None


class EnquiryResponse(EnquiryBase):
    id: int
    AccountName: Optional[str] = None
    ContactName: Optional[str] = None
    OwnerName: Optional[str] = None
    CreatedAt: datetime
    UpdatedAt: datetime
    Items: List[EnquiryItemResponse] = []

    class Config:
        from_attributes = True
