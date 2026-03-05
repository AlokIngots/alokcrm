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
    KAB = "KAB"
    
# SQLAlchemy Model
class Actual(Base):
    __tablename__ = "Actuals"
    
    ID = Column(Integer, primary_key=True, index=True, autoincrement=True)
    ECode = Column(String(10), ForeignKey("Users.ECode"), nullable=False)
    AccountID = Column(Integer, ForeignKey("Accounts.id"), nullable=True)  # Nullable for NEW accounts
    AccountType = Column(Enum(AccountTypeEnum), nullable=False)
    FY = Column(String(9), nullable=False)
    Month = Column(String(10), nullable=False)
    Actual = Column(Float, nullable=True)
    Qualified = Column(Float, nullable=True)
 
    # Relationships
    user = relationship("User", foreign_keys=[ECode])
    account = relationship("Account", foreign_keys=[AccountID])

# Pydantic Schemas
class ActualBase(BaseModel):
    ECode: str
    AccountID: Optional[int] = None
    AccountType: AccountTypeEnum
    FY: str
    Month: str
    Actual: Optional[float] = None
    Qualified: Optional[float] = None

class ActualCreate(ActualBase):
    pass

class ActualUpdate(BaseModel):
    ECode: Optional[str] = None
    AccountID: Optional[int] = None
    AccountType: Optional[AccountTypeEnum] = None
    FY: Optional[str] = None
    Month: Optional[str] = None
    Actual: Optional[float] = None
    Qualified: Optional[float] = None

class ActualResponse(ActualBase):
    ID: int
    
    class Config:
        from_attributes = True 