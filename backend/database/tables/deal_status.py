from sqlalchemy import Column, Integer, String, Text, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from database.db import Base
from pydantic import BaseModel
from typing import Optional
from enum import Enum

# Python Enum for Status
class StatusEnum(str, Enum):
    DEAL_ON_HOLD = "DEAL_ON_HOLD"
    DEAL_LOST = "DEAL_LOST"

# SQLAlchemy Model
class DealStatus(Base):
    __tablename__ = "DealStatus"
    
    ID = Column(Integer, primary_key=True, index=True, autoincrement=True)
    DealID = Column(Integer, ForeignKey("Deals.ID"), nullable=False)
    Status = Column(SQLEnum(StatusEnum), nullable=False)
    Reason = Column(String(255))
    Notes = Column(Text)
    
    # Relationship
    deal = relationship("Deal", backref="deal_statuses")

# Pydantic Schemas
class DealStatusBase(BaseModel):
    DealID: int
    Status: StatusEnum
    Reason: Optional[str] = None
    Notes: Optional[str] = None

class DealStatusCreate(DealStatusBase):
    pass

class DealStatusUpdate(BaseModel):
    DealID: Optional[int] = None
    Status: Optional[StatusEnum] = None
    Reason: Optional[str] = None
    Notes: Optional[str] = None

# Response schema with deal information
class DealStatusResponse(BaseModel):
    ID: int
    DealID: int
    DealInfo: Optional[str] = None  # Summary of deal (Company + Service)
    Status: StatusEnum
    Reason: Optional[str] = None
    Notes: Optional[str] = None
    
    class Config:
        from_attributes = True 