// crm/src/components/table/columnHelpers.js

import { getRoleColor } from '../../config/access-control';

// Common cell renderers
export const cellRenderers = {
    avatarWithName: (name) => (
      <div className="flex items-center">
        <div className="flex-shrink-0 h-8 w-8">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-sm font-medium">
            {name?.charAt(0)?.toUpperCase() || '?'}
          </div>
        </div>
        <div className="ml-3">
          <div className="text-sm font-medium text-gray-900">{name}</div>
        </div>
      </div>
    ),
  
    // Role badge
    roleBadge: (role) => {
      const badgeStyle = getRoleColor(role);
  
      return (
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${badgeStyle}`}>
          {role}
        </span>
      );
    },
  
    // Status badge
    statusBadge: (status, colorMap = {}) => {
      const defaultColors = {
        'Active': 'bg-green-100 text-green-700 border border-green-200',
        'Inactive': 'bg-red-100 text-red-700 border border-red-200',
        'Pending': 'bg-yellow-100 text-yellow-700 border border-yellow-200'
      };
      
      const colors = { ...defaultColors, ...colorMap };
      const badgeStyle = colors[status] || 'bg-gray-100 text-gray-700 border border-gray-200';
  
      return (
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${badgeStyle}`}>
          {status}
        </span>
      );
    },
  
    // Text with fallback
    textWithFallback: (value, fallback = '-') => (
      <div className="text-sm text-gray-900">
        {value || fallback}
      </div>
    ),
  
    // Date formatter
    dateFormatter: (date, format = 'short') => {
      if (!date) return '-';
      const dateObj = new Date(date);
      return (
        <div className="text-sm text-gray-900">
          {format === 'short' ? dateObj.toLocaleDateString() : dateObj.toLocaleString()}
        </div>
      );
    },
  
    // Currency formatter
    currencyFormatter: (amount, currency = 'USD') => {
      if (amount === null || amount === undefined) return '-';
      return (
        <div className="text-sm text-gray-900 font-medium">
          {new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency
          }).format(amount)}
        </div>
      );
    }
  };
  
  // Common column configurations
  export const createColumn = (accessorKey, header, options = {}) => ({
    accessorKey,
    header,
    enableSorting: options.enableSorting ?? true,
    enableColumnFilter: options.enableColumnFilter ?? true,
    cell: options.cell || (({ getValue }) => (
      <div className="text-sm text-gray-900">{getValue()}</div>
    )),
    ...options
  });