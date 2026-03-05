import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { authApi, userManager } from '../../pages/login/api/auth';
import { getFilteredMenuItems } from '../../config/sidebar';

const Sidebar = () => {
  const [expandedItems, setExpandedItems] = useState({});
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [filteredMenuItems, setFilteredMenuItems] = useState([]);
  const location = useLocation();
  const navigate = useNavigate();

  // Load user data and filter menu items on component mount
  useEffect(() => {
    const user = userManager.getUser();
    setCurrentUser(user);
    
    // Filter menu items based on user role
    const userRole = user?.Role;
    const menuItems = getFilteredMenuItems(userRole);
    setFilteredMenuItems(menuItems);
  }, []);

  useEffect(() => {
    // Auto-expand submenu when current route belongs to that parent.
    setExpandedItems((prev) => {
      const next = { ...prev };
      filteredMenuItems.forEach((item) => {
        if (item.hasSubmenu && Array.isArray(item.submenu)) {
          const isActiveParent = item.submenu.some((sub) => location.pathname === sub.path);
          if (isActiveParent) next[item.id] = true;
        }
      });
      return next;
    });
  }, [location.pathname, filteredMenuItems]);

  const toggleExpanded = (item) => {
    setExpandedItems(prev => ({
      ...prev,
      [item]: !prev[item]
    }));
  };

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
    // Close all expanded items when collapsing
    if (!isCollapsed) {
      setExpandedItems({});
    }
  };

  const isActive = (path) => {
    return location.pathname === path;
  };

  const isParentActive = (submenu) => {
    return submenu.some(item => location.pathname === item.path);
  };

  const handleLogout = () => {
    authApi.logout();
    navigate('/login');
  };

  // Get user display name and initials
  const getUserDisplayName = () => {
    if (!currentUser?.Name) return 'User';
    return currentUser.Name;
  };

  const getUserInitials = () => {
    if (!currentUser?.Name) return 'U';
    const names = currentUser.Name.split(' ');
    if (names.length >= 2) {
      return names[0].charAt(0) + names[names.length - 1].charAt(0);
    }
    return names[0].charAt(0);
  };

  return (
    <div 
      className={`${isCollapsed ? 'w-16' : 'w-50'} bg-white border-r border-gray-200 flex flex-col h-screen shadow-sm transition-all duration-300 flex-shrink-0 relative z-20`}
      style={{ minWidth: isCollapsed ? '4rem' : '14rem' }}
    >
      {/* Sidebar Header */}
      <div className="p-5 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
        <div className={`flex items-center justify-center gap-3 ${isCollapsed ? 'hidden' : ''}`}>
          <div className="flex items-center justify-center">
            <img src="/images/Alok_logo.png" alt="Alok Ingots Logo" width="170" />
          </div>
        </div>
        <button
          onClick={toggleSidebar}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <svg 
            className={`w-5 h-5 text-gray-600 transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 py-5 overflow-y-auto overflow-x-hidden">
        <ul className="space-y-1">
          {filteredMenuItems.map((item) => (
            <li key={item.id}>
              {item.hasSubmenu ? (
                <div>
                  <div 
                    className={`
                      flex items-center justify-between px-5 py-3 text-gray-600 cursor-pointer transition-all duration-200 hover:bg-gray-50 hover:text-gray-700
                      ${isParentActive(item.submenu) ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-500' : ''}
                    `}
                    onClick={() => !isCollapsed && toggleExpanded(item.id)}
                    title={isCollapsed ? item.label : ''}
                  >
                    <div className="flex items-center min-w-0">
                      <span className="w-5 h-5 mr-3 flex items-center justify-center text-base flex-shrink-0">
                        {item.icon}
                      </span>
                      {!isCollapsed && (
                        <span className="text-sm font-medium truncate">
                          {item.label}
                        </span>
                      )}
                    </div>
                    
                    {!isCollapsed && (
                      <span className={`
                        text-xs text-gray-400 transition-transform duration-200 flex-shrink-0
                        ${expandedItems[item.id] ? 'rotate-180' : ''}
                      `}>
                        ▼
                      </span>
                    )}
                  </div>
                  
                  {/* Submenu */}
                  {expandedItems[item.id] && !isCollapsed && (
                    <ul className="bg-gray-50 border-l-2 border-gray-200 ml-5">
                      {item.submenu.map((subItem, index) => (
                        <li key={index}>
                          <Link 
                            to={subItem.path}
                            className={`
                              block py-2 px-5 pl-8 text-xs cursor-pointer transition-all duration-200 hover:bg-gray-100 hover:text-gray-700 truncate
                              ${isActive(subItem.path) ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-600'}
                            `}
                          >
                            {subItem.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <Link 
                  to={item.path}
                  className={`
                    flex items-center px-5 py-3 cursor-pointer transition-all duration-200 hover:bg-gray-50 hover:text-gray-700
                    ${isActive(item.path) ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-500' : 'text-gray-600'}
                  `}
                  title={isCollapsed ? item.label : ''}
                >
                  <span className="w-5 h-5 mr-3 flex items-center justify-center text-base flex-shrink-0">
                    {item.icon}
                  </span>
                  {!isCollapsed && (
                    <span className="text-sm font-medium truncate">
                      {item.label}
                    </span>
                  )}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </nav>

      {/* User Info and Logout Section */}
      <div className="p-5 border-t border-gray-200 space-y-3 flex-shrink-0">
        {/* User Info */}
        {currentUser && (
          <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'px-5 py-2'} bg-gray-50 rounded-lg`}>
            <div className="flex items-center justify-center w-8 h-8 bg-blue-600 text-white rounded-full text-sm font-medium flex-shrink-0">
              {getUserInitials()}
            </div>
            {!isCollapsed && (
              <div className="ml-3 min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {getUserDisplayName()}
                </p>
                {/* {currentUser.Designation && (
                  <p className="text-xs text-gray-500 truncate">
                    {currentUser.Designation}
                  </p>
                )} */}
              </div>
            )}
          </div>
        )}

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className={`w-full flex items-center text-gray-600 hover:bg-red-50 hover:text-red-600 rounded-lg transition-all duration-200 group ${
            isCollapsed ? 'justify-center py-3' : 'px-5 py-3'
          }`}
          title={isCollapsed ? 'Logout' : ''}
        >
          <span className="w-5 h-5 flex items-center justify-center text-base flex-shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </span>
          {!isCollapsed && (
            <span className="text-sm font-medium ml-3">
              Logout
            </span>
          )}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
