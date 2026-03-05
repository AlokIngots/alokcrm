// crm/src/config/roles-master.js

export const ROLES = {
    'MD Office': {
      value: 'MD Office',
      label: 'Admin',
      color: 'bg-red-100 text-red-700 border border-red-200',
      hierarchy: 1
    },
    'Manager': {
      value: 'Manager',
      label: 'Sales Coordinator',
      color: 'bg-cyan-100 text-cyan-700 border border-cyan-200',
      hierarchy: 2
    },
    'Sales': {
      value: 'Sales',
      label: 'Sales',
      color: 'bg-blue-100 text-blue-600 border border-blue-200',
      hierarchy: 3
    }
  };
  
  // Helper functions for working with roles
  export const getRoleOptions = () => {
    return Object.values(ROLES).sort((a, b) => a.hierarchy - b.hierarchy);
  };
  
  export const getRoleColor = (roleValue) => {
    return ROLES[roleValue]?.color || 'bg-gray-100 text-gray-700 border border-gray-200';
  };
  
  export const getRoleLabel = (roleValue) => {
    return ROLES[roleValue]?.label || roleValue;
  };
  
  export const isValidRole = (roleValue) => {
    return roleValue in ROLES;
  };
  
  export const getRolesByHierarchy = (level) => {
    return Object.values(ROLES).filter(role => role.hierarchy === level);
  };
