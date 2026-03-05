from sqlalchemy import Column, String, ForeignKey
from sqlalchemy.orm import relationship
from database.db import Base
from pydantic import BaseModel
from typing import Optional

# SQLAlchemy Model for OUDesc
class OUDesc(Base):
    __tablename__ = "OUDesc"
    
    OU_Code = Column(String(5), primary_key=True, index=True)
    OU_NAME = Column(String(100), nullable=False)
    Status = Column(String(1))

# SQLAlchemy Model for AccessLevels view
class AccessLevels(Base):
    __tablename__ = "AccessLevels"
    
    ECode = Column(String(10), primary_key=True, index=True)
    COUCode = Column(String(5))
    ZOUCode = Column(String(5))
    DOUCode = Column(String(5))
    Name = Column(String(100))
    Cluster = Column(String(100))
    Zone = Column(String(100))
    Division = Column(String(100))
    BCZD = Column(String(50))

# SQLAlchemy Model
class User(Base):
    __tablename__ = "Users"
    
    ECode = Column(String(10), primary_key=True, index=True)
    Name = Column(String(100), nullable=False)
    Grade = Column(String(20))
    Designation = Column(String(100))
    Role = Column(String(50))
    ReportingManagerECode = Column(String(10), ForeignKey("Users.ECode"))
    PhoneNumber = Column(String(15))
    DOUCode = Column(String(5))  # Changed from Division
    ZOUCode = Column(String(5))  # Changed from Zone
    COUCode = Column(String(5))  # Changed from Cluster
    Access_Level = Column(String(1))  # A, D, Z, C, S
    
    # Self-referential relationship for reporting manager
    reporting_manager = relationship("User", remote_side=[ECode], backref="subordinates")

# Pydantic Schemas
class UserBase(BaseModel):
    ECode: str
    Name: str
    Grade: Optional[str] = None
    Designation: Optional[str] = None
    Role: Optional[str] = None
    ReportingManagerECode: Optional[str] = None
    PhoneNumber: Optional[str] = None
    DOUCode: Optional[str] = None  # Changed from Division
    ZOUCode: Optional[str] = None  # Changed from Zone
    COUCode: Optional[str] = None  # Changed from Cluster
    Access_Level: Optional[str] = None

class UserCreate(UserBase):
    pass

class UserUpdate(BaseModel):
    Name: Optional[str] = None
    Grade: Optional[str] = None
    Designation: Optional[str] = None
    Role: Optional[str] = None
    ReportingManagerECode: Optional[str] = None
    PhoneNumber: Optional[str] = None
    DOUCode: Optional[str] = None  # Changed from Division
    ZOUCode: Optional[str] = None  # Changed from Zone
    COUCode: Optional[str] = None  # Changed from Cluster
    Access_Level: Optional[str] = None

# Response schema that includes reporting manager name
class UserResponse(BaseModel):
    ECode: str
    Name: str
    Grade: Optional[str] = None
    Designation: Optional[str] = None
    Role: Optional[str] = None
    ReportingManagerECode: Optional[str] = None
    ReportingManagerName: Optional[str] = None
    PhoneNumber: Optional[str] = None
    DOUCode: Optional[str] = None  # Changed from Division
    ZOUCode: Optional[str] = None  # Changed from Zone
    COUCode: Optional[str] = None  # Changed from Cluster
    # Add the actual names from OUDesc
    Division: Optional[str] = None
    Zone: Optional[str] = None
    Cluster: Optional[str] = None
    
    class Config:
        from_attributes = True

# Alternative response schema with full reporting manager details
class UserWithManagerResponse(BaseModel):
    ECode: str
    Name: str
    Grade: Optional[str] = None
    Designation: Optional[str] = None
    Role: Optional[str] = None
    ReportingManagerECode: Optional[str] = None
    PhoneNumber: Optional[str] = None
    DOUCode: Optional[str] = None  # Changed from Division
    ZOUCode: Optional[str] = None  # Changed from Zone
    COUCode: Optional[str] = None  # Changed from Cluster
    reporting_manager: Optional[dict] = None
    
    class Config:
        from_attributes = True

# Pydantic model for OUDesc
class OUDescResponse(BaseModel):
    OU_Code: str
    OU_NAME: str
    Status: Optional[str] = None
    
    class Config:
        from_attributes = True

# Login schemas
class LoginRequest(BaseModel):
    ECode: str

class LoginResponse(BaseModel):
    message: str
    session_id: str

class OTPVerifyRequest(BaseModel):
    session_id: str
    otp: str

class OTPVerifyResponse(BaseModel):
    message: str
    access_token: str
    user: UserResponse 