// Access control configuration and utilities

// Role color configuration - can be dynamically assigned
export const getRoleColor = (role) => {
  const colorMap = {
    'MD Office': 'bg-red-100 text-red-700 border border-red-200',
    'Sales Manager': 'bg-cyan-100 text-cyan-700 border border-cyan-200',
    'MBD Sales Person': 'bg-blue-100 text-blue-600 border border-blue-200',
    'SOP Sales Person': 'bg-orange-100 text-orange-600 border border-orange-200',
    'Lead Generator': 'bg-green-100 text-green-600 border border-green-200',
    'Finance': 'bg-gray-100 text-gray-700 border border-gray-200',
  };
  
  return colorMap[role] || 'bg-gray-100 text-gray-700 border border-gray-200';
};

// Helper functions for backward compatibility
export const getRoleLabel = (roleValue) => {
  return roleValue;
};

export const isValidRole = (roleValue) => {
  return typeof roleValue === 'string' && roleValue.length > 0;
};

// Legacy functions for filtering salespeople (now permission-based)
export const filterSalespeople = (users, permissions) => {
  // If no permissions provided, filter based on traditional roles
  if (!permissions) {
    return users.filter(user => 
      ['MBD Sales Person', 'SOP Sales Person', 'Sales Manager'].includes(user.Role)
    );
  }
  
  // In the future, this could be permission-based filtering
  return users.filter(user => 
    ['MBD Sales Person', 'SOP Sales Person', 'Sales Manager'].includes(user.Role)
  );
};