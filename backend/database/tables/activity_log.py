from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database.db import Base
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

# SQLAlchemy Model
class ActivityLog(Base):
    __tablename__ = "ActivityLog"
    
    ID = Column(Integer, primary_key=True, index=True, autoincrement=True)
    DealID = Column(Integer, ForeignKey("Deals.ID"), nullable=False)
    ECode = Column(String(10), ForeignKey("Users.ECode"), nullable=False)
    CreatedAt = Column(DateTime, server_default=func.now())
    Action = Column(String(255), nullable=False)
    StageFrom = Column(String(50), nullable=True)
    StageTo = Column(String(50), nullable=True)
    
    # Relationships
    deal = relationship("Deal", backref="activities")
    user = relationship("User", backref="activities")

# Pydantic Models
class ActivityLogCreate(BaseModel):
    DealID: int
    Action: str
    StageFrom: Optional[str] = None
    StageTo: Optional[str] = None

class ActivityLogResponse(BaseModel):
    ID: int
    DealID: int
    ECode: str
    UserName: str 
    CreatedAt: datetime
    Action: str
    StageFrom: Optional[str] = None
    StageTo: Optional[str] = None
    DealName: Optional[str] = None  

    class Config:
        from_attributes = True

# Helper function to create stage change activity log
def create_stage_change_log(db, deal_id: int, user_ecode: str, stage_from: str, stage_to: str):
    """
    Helper function to create an activity log entry for stage changes
    """
    log_entry = ActivityLog(
        DealID=deal_id,
        ECode=user_ecode,
        Action=f"moved deal from {stage_from.replace('_', ' ')} to {stage_to.replace('_', ' ')}",
        StageFrom=stage_from,
        StageTo=stage_to
    )
    db.add(log_entry)
    return log_entry

# Helper function to create temperature change activity log
def create_temperature_change_log(db, deal_id: int, user_ecode: str, temperature_from: str, temperature_to: str):
    """
    Helper function to create an activity log entry for temperature changes
    """
    action_text = f"updated temperature to {temperature_to}"
    if temperature_from and temperature_from != "None":
        action_text = f"updated temperature from {temperature_from} to {temperature_to}"
    
    log_entry = ActivityLog(
        DealID=deal_id,
        ECode=user_ecode,
        Action=action_text
    )
    db.add(log_entry)
    return log_entry

# Helper function to create salesperson reassignment activity log
def create_salesperson_reassignment_log(db, deal_id: int, user_ecode: str, old_salesperson_name: str, new_salesperson_name: str):
    """
    Helper function to create an activity log entry for salesperson reassignments
    """
    log_entry = ActivityLog(
        DealID=deal_id,
        ECode=user_ecode,
        Action=f"reassigned the deal salesperson from {old_salesperson_name} to {new_salesperson_name}"
    )
    db.add(log_entry)
    return log_entry

# Helper function to create duplicate deal activity log
def create_duplicate_deal_log(db, deal_id: int, user_ecode: str):
    """
    Helper function to create an activity log entry for duplicate deals
    """
    log_entry = ActivityLog(
        DealID=deal_id,
        ECode=user_ecode,
        Action="deal marked as duplicate"
    )
    db.add(log_entry)
    return log_entry

