from sqlalchemy import Column, Integer, String, DECIMAL, Date, Text, ForeignKey, Boolean, Enum as SQLEnum
from sqlalchemy.orm import relationship
from database.db import Base
from pydantic import BaseModel
from typing import Optional
from datetime import date
from decimal import Decimal
from enum import Enum

# Python Enum for Deal Status
class DealStatusEnum(str, Enum):
    APPROVED = "APPROVED"
    REJECTED = "REJECTED" 
    PENDING = "PENDING"

# Python Enum for Deal Temperature
class DealTemperatureEnum(str, Enum):
    HOT = "HOT"
    COLD = "COLD"
    WARM = "WARM"

# Python Enum for Deal Flag
class DealFlagEnum(str, Enum):
    DUPLICATE = "DUPLICATE"
    KAM_APPROVAL = "KAM_APPROVAL"

# SQLAlchemy Model
class Deal(Base):
    __tablename__ = "Deals"
    
    ID = Column(Integer, primary_key=True, index=True, autoincrement=True)
    AccountID = Column(Integer, ForeignKey("Accounts.id"), nullable=False)
    SalespersonECode = Column(String(10), ForeignKey("Users.ECode"), nullable=False)
    ContactID = Column(Integer, ForeignKey("Contacts.id"), nullable=False)
    Division = Column(String(5))  # CHAR(5) in MySQL
    ServiceType = Column(String(100))
    DealValue = Column(DECIMAL(15, 2))
    ExpectedClosureDate = Column(Date)
    LeadGeneratedBy = Column(String(10), ForeignKey("Users.ECode"))
    LeadSource = Column(String(100))
    Stage = Column(String(100))
    Notes = Column(Text)
    Status = Column(SQLEnum(DealStatusEnum), nullable=False, default=DealStatusEnum.PENDING)
    DisplayDeal = Column(Boolean, default=True)
    Temperature = Column(SQLEnum(DealTemperatureEnum), nullable=True)
    Flag = Column(SQLEnum(DealFlagEnum), nullable=True)
    KAMECode = Column(String(10), ForeignKey("Users.ECode"), nullable=True)
    
    # Relationships
    account = relationship("Account", backref="deals")
    salesperson = relationship("User", foreign_keys=[SalespersonECode], backref="sales_deals")
    contact = relationship("Contact", backref="deals")
    lead_generator = relationship("User", foreign_keys=[LeadGeneratedBy], backref="generated_deals")
    kam = relationship("User", foreign_keys=[KAMECode], backref="kam_deals")

# Pydantic Schemas
class DealBase(BaseModel):
    AccountID: int
    SalespersonECode: str
    ContactID: int
    Division: Optional[str] = None
    ServiceType: Optional[str] = None
    DealValue: Optional[Decimal] = None
    ExpectedClosureDate: Optional[date] = None
    LeadGeneratedBy: Optional[str] = None
    LeadSource: Optional[str] = None
    Stage: Optional[str] = None
    Notes: Optional[str] = None

class DealCreate(DealBase):
    pass

class DealUpdate(BaseModel):
    # Only include the fields that can actually be updated
    DealValue: Optional[Decimal] = None
    ExpectedClosureDate: Optional[date] = None

# Response schema with related data
class DealResponse(BaseModel):
    ID: int
    AccountID: int
    AccountName: str  # From relationship
    SalespersonECode: str
    SalespersonName: str  # From relationship
    ContactID: int
    ContactName: str  # From relationship
    Division: Optional[str] = None
    ServiceType: Optional[str] = None
    DealValue: Optional[Decimal] = None
    ExpectedClosureDate: Optional[date] = None
    LeadGeneratedBy: Optional[str] = None
    LeadGeneratedByName: Optional[str] = None  # From relationship
    LeadSource: Optional[str] = None
    Stage: Optional[str] = None
    Notes: Optional[str] = None
    Status: DealStatusEnum
    DisplayDeal: bool
    Temperature: Optional[DealTemperatureEnum] = None
    Flag: Optional[DealFlagEnum] = None
    KAMECode: Optional[str] = None
    KAMName: Optional[str] = None  # From relationship
    Draggable: bool = False  # Add this new property
    
    class Config:
        from_attributes = True

class DealStageUpdate(BaseModel):
    Stage: str

class DealDisplayUpdate(BaseModel):
    DisplayDeal: bool

class DealTemperatureUpdate(BaseModel):
    Temperature: DealTemperatureEnum