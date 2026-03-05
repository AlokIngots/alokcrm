export const menuItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: '📊',
      path: '/dashboard'
    },
    {
      id: 'inbox',
      label: 'Inbox',
      icon: '📬',
      path: '/inbox'
    },
    {
      id: 'leaderboard',
      label: 'Leaderboard',
      icon: '🏆',
      path: '/leaderboard'
    },
    {
      id: 'enquiries',
      label: 'Enquiries (RFQ)',
      icon: '📥',
      path: '/enquiries'
    },
    {
      id: 'sales-pipeline',
      label: 'Sales Pipeline (Offers)',
      icon: '🧩',
      path: '/sales-pipeline'
    },
    {
      id: 'accounts',
      label: 'Accounts',
      icon: '🏢',
      path: '/accounts'
    },
    {
      id: 'contacts',
      label: 'Contacts',
      icon: '☎️',
      path: '/contacts'
    },
    {
      id: 'team',
      label: 'Team',
      icon: '👥',
      path: '/users'
    },
    {
      id: 'sales-performance',
      label: 'Sales Performance',
      icon: '📈',
      hasSubmenu: true,
      submenu: [
        {
          label: 'Set Targets',
          path: '/targets/set'
        },
        {
          label: 'Report Actuals',
          path: '/actuals/set'
        }
      ]
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: '📋',
      path: '/reports'
    },
    {
      id: 'activity-log',
      label: 'Activity Log',
      icon: '🔍',
      path: '/activity-log',
    }

  ];

// Helper function to check if user has access to a menu item
export const hasAccess = (menuItem, userRole) => {
  // If no role restrictions are defined, the item is accessible to all
  if (!menuItem.roleRestrictions || menuItem.roleRestrictions.length === 0) {
    return true;
  }
  
  // Check if user's role is in the allowed roles list
  const hasPermission = menuItem.roleRestrictions.includes(userRole);
  return hasPermission;
};

// Function to filter menu items based on user role
export const getFilteredMenuItems = (userRole) => {
  const filtered = menuItems.filter(item => hasAccess(item, userRole));
  return filtered;
};
