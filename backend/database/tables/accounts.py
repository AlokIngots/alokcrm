from sqlalchemy import Column, Integer, String, DECIMAL, Text, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from database.db import Base
from pydantic import BaseModel
from typing import Optional
from decimal import Decimal

# SQLAlchemy Model
class Account(Base):
    __tablename__ = "Accounts"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    Name = Column(String(255), nullable=False)
    Industry = Column(String(100))
    Website = Column(String(255))
    Turnover = Column(DECIMAL(15, 2))
    SCM_KAM = Column(String(10), ForeignKey("Users.ECode"))
    TPT_KAM = Column(String(10), ForeignKey("Users.ECode"))
    Division = Column(String(100))  # New field
    Location = Column(String(255))  # New field
    Notes = Column(Text)
    blacklist = Column(Boolean, default=False)  # New blacklist field
    
    # Relationships to Users table
    scm_kam_user = relationship("User", foreign_keys=[SCM_KAM])
    tpt_kam_user = relationship("User", foreign_keys=[TPT_KAM])

# Pydantic Schemas
class AccountBase(BaseModel):
    Name: str
    Industry: Optional[str] = None
    Website: Optional[str] = None
    Turnover: Optional[Decimal] = None
    SCM_KAM: Optional[str] = None
    TPT_KAM: Optional[str] = None
    Division: Optional[str] = None  # New field
    Location: Optional[str] = None  # New field
    Notes: Optional[str] = None
    blacklist: Optional[bool] = False  # New blacklist field

class AccountCreate(AccountBase):
    pass

class AccountUpdate(AccountBase):
    Name: Optional[str] = None

class AccountResponse(AccountBase):
    id: int
    SCM_KAM_Name: Optional[str] = None
    TPT_KAM_Name: Optional[str] = None
    
    class Config:
        from_attributes = True 