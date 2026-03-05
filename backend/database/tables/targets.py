from sqlalchemy import Column, Integer, String, ForeignKey, Enum, Float
from sqlalchemy.orm import relationship
from database.db import Base
from pydantic import BaseModel
from typing import Optional
import enum

# Enum for AccountType
class AccountTypeEnum(str, enum.Enum):
    NEW = "NEW"
    EXISTING = "EXISTING"

# SQLAlchemy Model
class Target(Base):
    __tablename__ = "Targets"
    
    ID = Column(Integer, primary_key=True, index=True, autoincrement=True)
    ECode = Column(String(10), ForeignKey("Users.ECode"), nullable=False)
    AccountID = Column(Integer, ForeignKey("Accounts.id"), nullable=True)  # Nullable for NEW accounts
    AccountType = Column(Enum(AccountTypeEnum), nullable=False)
    FY = Column(String(9), nullable=False)
    Month = Column(String(10), nullable=False)
    Target = Column(Float, nullable=True)  # Target value for that month
    
    # Relationships
    user = relationship("User", foreign_keys=[ECode])
    account = relationship("Account", foreign_keys=[AccountID])

# Pydantic Schemas
class TargetBase(BaseModel):
    ECode: str
    AccountID: Optional[int] = None
    AccountType: AccountTypeEnum
    FY: str
    Month: str
    Target: Optional[float] = None

class TargetCreate(TargetBase):
    pass

class TargetUpdate(BaseModel):
    ECode: Optional[str] = None
    AccountID: Optional[int] = None
    AccountType: Optional[AccountTypeEnum] = None
    FY: Optional[str] = None
    Month: Optional[str] = None
    Target: Optional[float] = None

class TargetResponse(TargetBase):
    ID: int
    
    class Config:
        from_attributes = True 