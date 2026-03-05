import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { permissionsApi } from '../api/permissions';
import { userManager } from '../pages/login/api/auth';

// Create the context
const AccessControlContext = createContext();

// Default permissions structure
const defaultPermissions = {
  deals: {
    create: false,
    reassign: false
  },
  accounts: {
    create: false,
    edit: false,
    blacklist: false
  },
  users: {
    create: false,
    edit: false
  },
  contacts: {
    create: false,
    edit: false
  }
};

// AccessControl Provider Component
export const AccessControlProvider = ({ children }) => {
  const [permissions, setPermissions] = useState(defaultPermissions);
  const [roles, setRoles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch user permissions
  const fetchPermissions = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const currentUser = userManager.getUser();
      if (!currentUser) {
        setPermissions(defaultPermissions);
        return;
      }

      const response = await permissionsApi.getUserPermissions();
      setPermissions(response.permissions || defaultPermissions);
    } catch (err) {
      console.error('Error fetching permissions:', err);
      setError(err.message);
      setPermissions(defaultPermissions);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch available roles
  const fetchRoles = useCallback(async () => {
    try {
      const rolesList = await permissionsApi.getAllRoles();
      setRoles(rolesList || []);
    } catch (err) {
      console.error('Error fetching roles:', err);
      setRoles([]);
    }
  }, []);

  // Initialize permissions on mount
  useEffect(() => {
    fetchPermissions();
    fetchRoles();
  }, [fetchPermissions, fetchRoles]);

  // Refresh permissions (useful after login/logout)
  const refreshPermissions = useCallback(() => {
    fetchPermissions();
    fetchRoles();
  }, [fetchPermissions, fetchRoles]);

  // Permission check helpers
  const can = useCallback((resource, action) => {
    return permissions[resource]?.[action] || false;
  }, [permissions]);

  // Batch permission checks
  const canCreate = useCallback((resource) => can(resource, 'create'), [can]);
  const canEdit = useCallback((resource) => can(resource, 'edit'), [can]);
  const canReassign = useCallback((resource) => can(resource, 'reassign'), [can]);
  const canBlacklist = useCallback((resource) => can(resource, 'blacklist'), [can]);

  const contextValue = {
    permissions,
    roles,
    isLoading,
    error,
    refreshPermissions,
    can,
    canCreate,
    canEdit,
    canReassign,
    canBlacklist,
    // Specific permission helpers for common use cases
    canCreateDeals: permissions.deals?.create || false,
    canReassignDeals: permissions.deals?.reassign || false,
    canCreateAccounts: permissions.accounts?.create || false,
    canEditAccounts: permissions.accounts?.edit || false,
    canBlacklistAccounts: permissions.accounts?.blacklist || false,
    canCreateUsers: permissions.users?.create || false,
    canEditUsers: permissions.users?.edit || false,
    canCreateContacts: permissions.contacts?.create || false,
    canEditContacts: permissions.contacts?.edit || false,
  };

  return (
    <AccessControlContext.Provider value={contextValue}>
      {children}
    </AccessControlContext.Provider>
  );
};

// Custom hook to use the access control context
export const useAccessControl = () => {
  const context = useContext(AccessControlContext);
  if (!context) {
    throw new Error('useAccessControl must be used within an AccessControlProvider');
  }
  return context;
};

// Custom hooks for specific permissions (for convenience)
export const usePermissions = () => {
  const { permissions } = useAccessControl();
  return permissions;
};

export const useRoles = () => {
  const { roles } = useAccessControl();
  return roles;
};

// Component-level permission wrapper
export const PermissionGuard = ({ 
  resource, 
  action, 
  children, 
  fallback = null,
  loading = null 
}) => {
  const { can, isLoading } = useAccessControl();

  if (isLoading) {
    return loading;
  }

  if (!can(resource, action)) {
    return fallback;
  }

  return children;
}; 