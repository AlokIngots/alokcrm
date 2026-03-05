import React, { useState, useEffect, useMemo } from 'react';
import { targetsApi } from './api/targets';
import { exportTargetsToExcel } from '../../utils/excelExport';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const Targets = () => {
  const [subordinates, setSubordinates] = useState([]);
  const [financialYears, setFinancialYears] = useState([]);
  const [targetData, setTargetData] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedFY, setSelectedFY] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingFY, setIsLoadingFY] = useState(false);
  const [isLoadingTargets, setIsLoadingTargets] = useState(false);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'graph'
  const [chartType, setChartType] = useState('line'); // 'line', 'area', 'bar'

  // Load subordinates on component mount
  useEffect(() => {
    fetchSubordinates();
  }, []);

  // Load financial years when user is selected
  useEffect(() => {
    if (selectedUser) {
      fetchFinancialYears();
    } else {
      setFinancialYears([]);
      setSelectedFY('');
      setTargetData([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUser]);

  // Load targets when both user and FY are selected
  useEffect(() => {
    if (selectedUser && selectedFY) {
      fetchTargets();
    } else {
      setTargetData([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUser, selectedFY]);

  const fetchSubordinates = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await targetsApi.getSubordinates();
      setSubordinates(response.subordinates || []);
    } catch (err) {
      setError('Failed to load subordinates. Please try again.');
      console.error('Error fetching subordinates:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchFinancialYears = async () => {
    setIsLoadingFY(true);
    setError(null);

    try {
      const years = await targetsApi.getFinancialYears(selectedUser);
      console.log('Financial years response:', years); // Debug log
      
      // Ensure we always have an array
      if (Array.isArray(years)) {
        setFinancialYears(years);
      } else {
        console.warn('Financial years is not an array:', years);
        setFinancialYears([]);
      }
    } catch (err) {
      setError('Failed to load financial years. Please try again.');
      console.error('Error fetching financial years:', err);
      setFinancialYears([]); // Ensure we set an empty array on error
    } finally {
      setIsLoadingFY(false);
    }
  };

  const fetchTargets = async () => {
    setIsLoadingTargets(true);
    setError(null);

    try {
      const targets = await targetsApi.getUserTargets(selectedUser, selectedFY);
      setTargetData(targets || []);
    } catch (err) {
      setError('Failed to load targets. Please try again.');
      console.error('Error fetching targets:', err);
    } finally {
      setIsLoadingTargets(false);
    }
  };

  const handleUserChange = (e) => {
    setSelectedUser(e.target.value);
    setSelectedFY('');
    setTargetData([]);
    setError(null);
  };

  const handleFYChange = (e) => {
    setSelectedFY(e.target.value);
    setError(null);
  };

  // Prepare data for charts
  const chartData = useMemo(() => {
    if (!targetData.length) return [];

    const months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
    
    return months.map(month => {
      const monthData = { month };
      let totalForMonth = 0;
      
      targetData.forEach((row, index) => {
        const value = row[month] || 0;
        monthData[`Account_${index}`] = value;
        monthData[row.Account || `Account ${index + 1}`] = value;
        totalForMonth += value;
      });
      
      monthData.total = totalForMonth;
      return monthData;
    });
  }, [targetData]);

  // Colors for chart
  const colors = [
    '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
    '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16'
  ];

  const getTotalTargets = () => {
    return targetData.reduce((total, row) => {
      const months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
      return total + months.reduce((rowTotal, month) => rowTotal + (row[month] || 0), 0);
    }, 0);
  };

  const getSelectedUserName = () => {
    const user = subordinates.find(sub => sub.ECode === selectedUser);
    return user ? user.Name : '';
  };

  const handleDownloadExcel = () => {
    try {
      const userName = getSelectedUserName();
      exportTargetsToExcel(targetData, userName, selectedFY);
    } catch (error) {
      setError('Failed to download Excel file. Please try again.');
      console.error('Error downloading Excel:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex items-center">
            <svg className="animate-spin h-8 w-8 text-blue-600 mr-3" fill="none" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle>
              <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75"></path>
            </svg>
            <span className="text-gray-600 text-lg">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">View Targets</h1>
        <p className="text-gray-600 mt-1">View targets data for your team members</p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-red-800">{error}</span>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* User Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Team Member <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedUser}
              onChange={handleUserChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select a team member</option>
              {subordinates.map(user => (
                <option key={user.ECode} value={user.ECode}>
                  {user.Name} ({user.ECode})
                </option>
              ))}
            </select>
          </div>

          {/* FY Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Financial Year <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedFY}
              onChange={handleFYChange}
              disabled={!selectedUser || isLoadingFY}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="">
                {!selectedUser ? 'Select a team member first' : isLoadingFY ? 'Loading...' : 'Select financial year'}
              </option>
              {Array.isArray(financialYears) && financialYears.map(fy => (
                <option key={fy} value={fy}>
                  {fy}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Content Area */}
      {selectedUser && selectedFY && (
        <>
          {/* View Toggle and Stats */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Targets for {getSelectedUserName()} - FY {selectedFY}
                </h2>
                <p className="text-gray-600 text-sm mt-1">
                  Total Target: <span className="font-medium">{getTotalTargets().toLocaleString()}</span>
                </p>
              </div>

              <div className="flex items-center gap-3">
                {/* View Mode Toggle */}
                <div className="flex bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('table')}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                      viewMode === 'table'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Table
                  </button>
                  <button
                    onClick={() => setViewMode('graph')}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                      viewMode === 'graph'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Graph
                  </button>
                </div>

                {/* Chart Type Selector (only for graph view) */}
                {viewMode === 'graph' && (
                  <select
                    value={chartType}
                    onChange={(e) => setChartType(e.target.value)}
                    className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="line">Line Chart</option>
                    <option value="area">Area Chart</option>
                    <option value="bar">Bar Chart</option>
                  </select>
                )}

                {/* Download Excel Button */}
                {targetData.length > 0 && (
                  <button
                    onClick={handleDownloadExcel}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center text-sm"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Download Excel
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Data Display */}
          {isLoadingTargets ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-center h-64">
                <div className="flex items-center">
                  <svg className="animate-spin h-6 w-6 text-blue-600 mr-3" fill="none" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle>
                    <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75"></path>
                  </svg>
                  <span className="text-gray-600">Loading targets...</span>
                </div>
              </div>
            </div>
          ) : targetData.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="text-center text-gray-500 py-12">
                <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <p>No targets data found for the selected criteria</p>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              {viewMode === 'table' ? (
                /* Table View */
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="sticky left-0 bg-gray-50 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                          Account
                        </th>
                        {['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'].map(month => (
                          <th key={month} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {month}
                          </th>
                        ))}
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-blue-50">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {targetData.map((row, index) => {
                        const months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
                        const rowTotal = months.reduce((total, month) => total + (row[month] || 0), 0);
                        
                        return (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="sticky left-0 bg-white px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 border-r border-gray-200">
                              <div className="max-w-xs truncate" title={row.Account}>
                                {row.Account}
                              </div>
                            </td>
                            {months.map(month => (
                              <td key={month} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {row[month] ? row[month].toLocaleString() : '-'}
                              </td>
                            ))}
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600 bg-blue-50">
                              {rowTotal.toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                /* Graph View */
                <div className="p-6">
                  <div className="h-96 mb-6">
                    <ResponsiveContainer width="100%" height="100%">
                      {chartType === 'line' && (
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="month" />
                          <YAxis />
                          <Tooltip 
                            formatter={(value, name) => [value?.toLocaleString(), name]}
                            labelFormatter={(label) => `Month: ${label}`}
                          />
                          <Legend />
                          {targetData.map((row, index) => (
                            <Line
                              key={index}
                              type="monotone"
                              dataKey={row.Account}
                              stroke={colors[index % colors.length]}
                              strokeWidth={2}
                              dot={{ r: 4 }}
                              connectNulls={false}
                            />
                          ))}
                        </LineChart>
                      )}
                      {chartType === 'area' && (
                        <AreaChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="month" />
                          <YAxis />
                          <Tooltip 
                            formatter={(value, name) => [value?.toLocaleString(), name]}
                            labelFormatter={(label) => `Month: ${label}`}
                          />
                          <Legend />
                          {targetData.map((row, index) => (
                            <Area
                              key={index}
                              type="monotone"
                              dataKey={row.Account}
                              stackId="1"
                              stroke={colors[index % colors.length]}
                              fill={colors[index % colors.length]}
                              fillOpacity={0.6}
                            />
                          ))}
                        </AreaChart>
                      )}
                      {chartType === 'bar' && (
                        <BarChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="month" />
                          <YAxis />
                          <Tooltip 
                            formatter={(value, name) => [value?.toLocaleString(), name]}
                            labelFormatter={(label) => `Month: ${label}`}
                          />
                          <Legend />
                          {targetData.map((row, index) => (
                            <Bar
                              key={index}
                              dataKey={row.Account}
                              fill={colors[index % colors.length]}
                            />
                          ))}
                        </BarChart>
                      )}
                    </ResponsiveContainer>
                  </div>

                  {/* Account Legend */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {targetData.map((row, index) => {
                      const months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
                      const total = months.reduce((sum, month) => sum + (row[month] || 0), 0);
                      
                      return (
                        <div key={index} className="flex items-center p-3 bg-gray-50 rounded-lg">
                          <div
                            className="w-4 h-4 rounded-full mr-3"
                            style={{ backgroundColor: colors[index % colors.length] }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {row.Account}
                            </p>
                            <p className="text-xs text-gray-500">
                              Total: {total.toLocaleString()}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Targets;
