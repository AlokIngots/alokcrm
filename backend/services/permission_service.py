from sqlalchemy.orm import Session
from fastapi import HTTPException
from database.tables.users import User
from database.tables.role_permissions import RolePermission
from typing import Optional

class PermissionService:
    """
    Service to handle role-based permission checks
    """
    
    def __init__(self, db: Session):
        self.db = db
    
    def get_user_permissions(self, user_role: str) -> Optional[RolePermission]:
        """
        Get permissions for a specific role
        """
        return self.db.query(RolePermission).filter(
            RolePermission.role == user_role
        ).first()
    
    def check_permission(self, user: User, permission_type: str, action: str) -> bool:
        """
        Check if user has specific permission
        
        Args:
            user: Current user object
            permission_type: Type of permission (deals, accounts, users, contacts)
            action: Action to check (create, edit, reassign)
        
        Returns:
            Boolean indicating if user has permission
        """
        if not user.Role:
            return False
        
        permissions = self.get_user_permissions(user.Role)
        if not permissions:
            return False
        
        # Map permission types and actions to database fields
        permission_field = f"{permission_type}_{action}"
        
        # Check if the permission field exists and return its value
        return getattr(permissions, permission_field, False)
    
    def require_permission(self, user: User, permission_type: str, action: str) -> None:
        """
        Require specific permission or raise HTTPException
        
        Args:
            user: Current user object
            permission_type: Type of permission (deals, accounts, users, contacts)
            action: Action to check (create, edit, reassign)
        
        Raises:
            HTTPException: If user doesn't have required permission
        """
        if not self.check_permission(user, permission_type, action):
            raise HTTPException(
                status_code=403, 
                detail=f"Access denied: Your role '{user.Role}' does not have permission to {action} {permission_type}"
            )

# Dependency function for FastAPI
def get_permission_service(db: Session) -> PermissionService:
    """
    FastAPI dependency to get permission service
    """
    return PermissionService(db) 