import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { activityLogSummaryApi } from './api/activity-log';
import { formatIndianCurrency, formatDate } from '../sales-pipeline/utils/formatters';
import Table from '../../components/table/Table';

const ActivityLog = () => {
  const [activityLogs, setActivityLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  
  // Date range filter state
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  
  // Set default date range to last 30 days
  useEffect(() => {
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    setFromDate(thirtyDaysAgo.toISOString().split('T')[0]);
    setToDate(today.toISOString().split('T')[0]);
  }, []);

  // Fetch activity logs
  const fetchActivityLogs = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const filters = {};
      if (fromDate) filters.fromDate = fromDate;
      if (toDate) filters.toDate = toDate;
      
      const logs = await activityLogSummaryApi.getActivityLogSummary(filters);
      setActivityLogs(logs);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error fetching activity logs:', error);
      setError(error.message);
      setActivityLogs([]);
    } finally {
      setIsLoading(false);
    }
  }, [fromDate, toDate]);

  // Load activity logs when date range changes
  useEffect(() => {
    if (fromDate && toDate) {
      fetchActivityLogs();
    }
  }, [fromDate, toDate, fetchActivityLogs]);

  // Format timestamp for display
  const formatActivityTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
   
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  // Get user initials for avatar
  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Get avatar color based on name
  const getAvatarColor = (name) => {
    if (!name) return 'bg-gray-500';
    const colors = [
      'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 
      'bg-red-500', 'bg-indigo-500', 'bg-pink-500', 'bg-teal-500'
    ];
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  // Define table columns
  const columns = useMemo(() => [
    {
      id: 'user',
      header: 'User',
      accessorKey: 'user',
      cell: ({ row }) => {
        const user = row.original.user;
        return (
          <div className="flex items-center space-x-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${getAvatarColor(user)}`}>
              {getInitials(user)}
            </div>
            <span className="font-medium text-gray-900">{user}</span>
          </div>
        );
      },
      enableSorting: true,
      filterFn: 'includesString',
    },
    {
      id: 'account',
      header: 'Account',
      accessorKey: 'account',
      cell: ({ row }) => {
        const account = row.original.account;
        return (
          <div className="text-sm text-gray-900 max-w-xs">
            <div className="truncate font-medium">{account}</div>
          </div>
        );
      },
      enableSorting: true,
      filterFn: 'includesString',
    },
    // {
    //   id: 'division',
    //   header: 'Division',
    //   accessorKey: 'division',
    //   cell: ({ row }) => {
    //     const division = row.original.division;
    //     const divisionConfig = getDivisionConfig(division);
    //     return (
    //       <span className={`inline-flex px-2 rounded-full text-xs font-medium ${divisionConfig.badgeColor}`}>
    //         {divisionConfig.label}
    //       </span>
    //     );
    //   },
    //   enableSorting: true,
    //   filterFn: 'includesString',
    // },
    {
      id: 'service_type',
      header: 'Service Type',
      accessorKey: 'service_type',
      cell: ({ row }) => {
        const serviceType = row.original.service_type;
        return (
          <span className="text-sm text-gray-900">{serviceType}</span>
        );
      },
      enableSorting: true,
      filterFn: 'includesString',
    },
    {
      id: 'deal_value',
      header: 'Deal Value',
      accessorKey: 'deal_value',
      cell: ({ row }) => {
        const dealValue = row.original.deal_value;
        return (
          <span className="text-sm font-medium text-green-600">
            {dealValue ? formatIndianCurrency(dealValue) : '—'}
          </span>
        );
      },
      enableSorting: true,
      sortingFn: (rowA, rowB) => {
        const a = rowA.original.deal_value || 0;
        const b = rowB.original.deal_value || 0;
        return a - b;
      },
    },
    {
      id: 'action',
      header: 'Activity',
      accessorKey: 'action',
      cell: ({ row }) => {
        const action = row.original.action;
        return (
          <div className="text-sm text-gray-700 max-w-md">
            <div className="truncate">{action}</div>
          </div>
        );
      },
      enableSorting: false,
      filterFn: 'includesString',
    },
    {
      id: 'timestamp',
      header: 'Time',
      accessorKey: 'timestamp',
      cell: ({ row }) => {
        const timestamp = row.original.timestamp;
        return (
          <div className="text-sm text-gray-500">
            {formatActivityTime(timestamp)}
          </div>
        );
      },
      enableSorting: true,
      sortingFn: (rowA, rowB) => {
        const a = new Date(rowA.original.timestamp);
        const b = new Date(rowB.original.timestamp);
        return b - a; // Descending order (newest first)
      },
    },
  ], []);

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Activity Log</h1>
              <p className="text-gray-600 mt-1">Global activity across all deals and accounts</p>
            </div>
            <div className="flex items-center space-x-4">
              {lastRefresh && (
                <span className="text-sm text-gray-500">
                  Last updated: {formatActivityTime(lastRefresh)}
                </span>
              )}
              <button
                onClick={fetchActivityLogs}
                disabled={isLoading}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {isLoading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          </div>
        </div>

        {/* Date Range Filter */}
        <div className="mb-6 bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h3 className="text-sm font-medium text-gray-900">Filter by Date Range</h3>
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2">
                  <label htmlFor="fromDate" className="text-sm text-gray-600">From:</label>
                  <input
                    type="date"
                    id="fromDate"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <label htmlFor="toDate" className="text-sm text-gray-600">To:</label>
                  <input
                    type="date"
                    id="toDate"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  const today = new Date();
                  setFromDate(today.toISOString().split('T')[0]);
                  setToDate(today.toISOString().split('T')[0]);
                }}
                className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors"
              >
                Today
              </button>
              <button
                onClick={() => {
                  const today = new Date();
                  const lastWeek = new Date(today);
                  lastWeek.setDate(today.getDate() - 7);
                  setFromDate(lastWeek.toISOString().split('T')[0]);
                  setToDate(today.toISOString().split('T')[0]);
                }}
                className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors"
              >
                Last 7 Days
              </button>
              <button
                onClick={() => {
                  const today = new Date();
                  const lastMonth = new Date(today);
                  lastMonth.setDate(today.getDate() - 30);
                  setFromDate(lastMonth.toISOString().split('T')[0]);
                  setToDate(today.toISOString().split('T')[0]);
                }}
                className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors"
              >
                Last 30 Days
              </button>
              <button
                onClick={() => {
                  const today = new Date();
                  const lastQuarter = new Date(today);
                  lastQuarter.setDate(today.getDate() - 90);
                  setFromDate(lastQuarter.toISOString().split('T')[0]);
                  setToDate(today.toISOString().split('T')[0]);
                }}
                className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors"
              >
                Last 90 Days
              </button>
            </div>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <span className="text-red-700 font-medium">Error loading activity log:</span>
              <span className="text-red-600 ml-2">{error}</span>
            </div>
          </div>
        )}

        {/* Activity Summary Stats */}
        {!isLoading && !error && activityLogs.length > 0 && (
          <div className="mb-6">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Activity Summary</h3>
              <span className="text-sm text-gray-500">
                {formatDate(fromDate)} to {formatDate(toDate)}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <div className="text-2xl font-bold text-blue-600">{activityLogs.length}</div>
                <div className="text-sm text-gray-600">Total Activities</div>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <div className="text-2xl font-bold text-green-600">
                  {new Set(activityLogs.map(log => log.user)).size}
                </div>
                <div className="text-sm text-gray-600">Active Users</div>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <div className="text-2xl font-bold text-purple-600">
                  {new Set(activityLogs.map(log => log.account)).size}
                </div>
                <div className="text-sm text-gray-600">Accounts Involved</div>
              </div>
            </div>
          </div>
        )}

        {/* Activity Table */}
        <Table
          data={activityLogs}
          columns={columns}
          isLoading={isLoading}
          pageSize={15}
          enableGlobalFilter={true}
          enableColumnFilters={true}
          enableSorting={true}
          enablePagination={true}
        />

       
      </div>
    </div>
  );
};

export default ActivityLog; 
