from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Enum as SQLEnum
from sqlalchemy.orm import relationship
from database.db import Base
from pydantic import BaseModel
from typing import Optional
from enum import Enum
from datetime import datetime

# Enum for status
class BlacklistStatusEnum(str, Enum):
    ENABLED = "ENABLED"
    DISABLED = "DISABLED"

# SQLAlchemy Model
class BlacklistReason(Base):
    __tablename__ = "BlacklistReason"

    ID = Column(Integer, primary_key=True, index=True, autoincrement=True)
    AccountID = Column(Integer, ForeignKey("Accounts.id"), nullable=False)
    Reason = Column(String(255))
    Notes = Column(Text)
    Status = Column(SQLEnum(BlacklistStatusEnum), nullable=False, default=BlacklistStatusEnum.ENABLED)
    CreatedAt = Column(DateTime, default=datetime.utcnow)
    CreatedBy = Column(String(10), ForeignKey("Users.ECode"))

    # Relationships
    account = relationship("Account", backref="blacklist_reasons")
    created_by_user = relationship("User", backref="created_blacklist_entries", foreign_keys=[CreatedBy])

# Pydantic Schemas
class BlacklistReasonBase(BaseModel):
    AccountID: int
    Reason: Optional[str] = None
    Notes: Optional[str] = None
    Status: BlacklistStatusEnum = BlacklistStatusEnum.ENABLED
    CreatedBy: Optional[str] = None  # ECode of the user

class BlacklistReasonCreate(BlacklistReasonBase):
    pass

class BlacklistReasonUpdate(BaseModel):
    Reason: Optional[str] = None
    Notes: Optional[str] = None
    Status: Optional[BlacklistStatusEnum] = None
    CreatedBy: Optional[str] = None

class BlacklistReasonResponse(BlacklistReasonBase):
    ID: int
    CreatedAt: datetime
    AccountName: Optional[str] = None
    CreatedByName: Optional[str] = None

    class Config:
        from_attributes = True
