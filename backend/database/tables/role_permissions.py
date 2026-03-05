from sqlalchemy import Column, String, Boolean
from database.db import Base
from pydantic import BaseModel
from typing import Optional

# SQLAlchemy Model
class RolePermission(Base):
    __tablename__ = "RolePermissions"
    
    role = Column(String(50), primary_key=True, index=True)
    deals_create = Column(Boolean, default=False)
    deals_reassign = Column(Boolean, default=False)
    deals_edit = Column(Boolean, default=False)
    accounts_create = Column(Boolean, default=False)
    accounts_edit = Column(Boolean, default=False)
    accounts_blacklist = Column(Boolean, default=False)  # New blacklist permission
    users_create = Column(Boolean, default=False)
    users_edit = Column(Boolean, default=False)
    contacts_create = Column(Boolean, default=False)
    contacts_edit = Column(Boolean, default=False)
    duplicate_deals_approve = Column(Boolean, default=False)

# Pydantic Schemas
class RolePermissionBase(BaseModel):
    role: str
    deals_create: bool = False
    deals_reassign: bool = False
    deals_edit: bool = False
    accounts_create: bool = False
    accounts_edit: bool = False
    accounts_blacklist: bool = False  # New blacklist permission
    users_create: bool = False
    users_edit: bool = False
    contacts_create: bool = False
    contacts_edit: bool = False
    duplicate_deals_approve: bool = False

class RolePermissionCreate(RolePermissionBase):
    pass

class RolePermissionUpdate(BaseModel):
    deals_create: Optional[bool] = None
    deals_reassign: Optional[bool] = None
    deals_edit: Optional[bool] = None
    accounts_create: Optional[bool] = None
    accounts_edit: Optional[bool] = None
    accounts_blacklist: Optional[bool] = None  # New blacklist permission
    users_create: Optional[bool] = None
    users_edit: Optional[bool] = None
    contacts_create: Optional[bool] = None
    contacts_edit: Optional[bool] = None
    duplicate_deals_approve: Optional[bool] = None

class RolePermissionResponse(RolePermissionBase):
    class Config:
        from_attributes = True

# Structured permission response for the API
class PermissionCategory(BaseModel):
    create: Optional[bool] = None
    edit: Optional[bool] = None
    reassign: Optional[bool] = None
    blacklist: Optional[bool] = None  # New blacklist permission

class UserPermissionsResponse(BaseModel):
    permissions: dict 