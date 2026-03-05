from sqlalchemy import Column, Integer, String, Text, ForeignKey
from sqlalchemy.orm import relationship
from database.db import Base
from pydantic import BaseModel, EmailStr
from typing import Optional

# SQLAlchemy Model
class Contact(Base):
    __tablename__ = "Contacts"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    Name = Column(String(100), nullable=False)
    AccountID = Column(Integer, ForeignKey("Accounts.id"), nullable=False)
    Designation = Column(String(100), nullable=False)
    Email1 = Column(String(150), nullable=False)
    Email2 = Column(String(150))
    Phone1 = Column(String(20))
    Phone2 = Column(String(20))
    Notes = Column(Text)
    
    # Relationship to Account
    account = relationship("Account")

# Pydantic Schemas
class ContactBase(BaseModel):
    Name: str
    AccountID: int
    Designation: str
    Email1: str
    Email2: Optional[str] = None
    Phone1: Optional[str] = None
    Phone2: Optional[str] = None
    Notes: Optional[str] = None

class ContactCreate(ContactBase):
    pass

class ContactUpdate(BaseModel):
    Name: Optional[str] = None
    AccountID: Optional[int] = None
    Designation: Optional[str] = None
    Email1: Optional[str] = None
    Email2: Optional[str] = None
    Phone1: Optional[str] = None
    Phone2: Optional[str] = None
    Notes: Optional[str] = None

# Response schema that includes account information
class ContactResponse(BaseModel):
    id: int
    Name: str
    AccountID: int
    Account: str
    Designation: str
    Email1: str
    Email2: Optional[str] = None
    Phone1: Optional[str] = None
    Phone2: Optional[str] = None
    Notes: Optional[str] = None
    
    class Config:
        from_attributes = True

# Alternative response schema with full company details
class ContactWithCompanyResponse(BaseModel):
    id: int
    Name: str
    AccountID: int
    Designation: str
    Email1: str
    Email2: Optional[str] = None
    Phone1: Optional[str] = None
    Phone2: Optional[str] = None
    Notes: Optional[str] = None
    company: dict  # Full company object
    
    class Config:
        from_attributes = True