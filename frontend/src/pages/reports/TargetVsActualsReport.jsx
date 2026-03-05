import React, { useState, useEffect, useMemo } from 'react';
import { reportsApi } from './api/reports';
import { exportTargetVsActualsToExcel } from '../../utils/excelExport';
import { getDivisionLabel } from '../../config/divisions';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

const TargetVsActualsReport = () => {
  // State for filters
  const [filters, setFilters] = useState({
    fy: '',
    division: '',
    salesperson: ''
  });

  // State for data
  const [reportData, setReportData] = useState({});
  const [customerData, setCustomerData] = useState({});
  const [filterOptions, setFilterOptions] = useState({
    divisions: [],
    salespeople: [],
    access_level: null
  });

  const [financialYears, setFinancialYears] = useState([]);
  
  // State for loading and errors
  const [loading, setLoading] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [loadingFY, setLoadingFY] = useState(false);
  const [error, setError] = useState('');

  // State for view mode and chart type
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'graph'
  const [chartType, setChartType] = useState('line'); // 'line' or 'bar'
  const [showCustomerLevel, setShowCustomerLevel] = useState(false); // Toggle for customer-level view
  const [activeCustomerTab, setActiveCustomerTab] = useState('kab'); // 'kab', 'existing', 'new'

  // Fetch financial years on component mount
  useEffect(() => {
    const fetchFinancialYears = async () => {
      setLoadingFY(true);
      try {
        const years = await reportsApi.getFinancialYears();
        setFinancialYears(years);
        
        // Auto-select the first financial year if available
        if (years.length > 0) {
          setFilters(prev => (prev.fy ? prev : { ...prev, fy: years[0] }));
        }
      } catch (err) {
        console.error('Error fetching financial years:', err);
        setError('Failed to fetch financial years');
        setFinancialYears([]);
      } finally {
        setLoadingFY(false);
      }
    };

    fetchFinancialYears();
  }, []);

  // Fetch filter options when filters change
  useEffect(() => {
    const fetchFilterOptions = async () => {
      setLoadingOptions(true);
      try {
        const options = await reportsApi.getFilterOptions({
          division: filters.division
        });
        setFilterOptions(options);
        
        // Auto-populate filters based on access level restrictions
        setFilters(prev => {
          const newFilters = { ...prev };
          
          // If there's only one division available, auto-select it
          if (options.divisions.length === 1 && !prev.division) {
            newFilters.division = options.divisions[0].code;
          }
          
          // If there's only one salesperson available, auto-select it
          if (options.salespeople.length === 1 && !prev.salesperson) {
            newFilters.salesperson = options.salespeople[0].ECode;
          }
          
          return newFilters;
        });
      } catch (err) {
        console.error('Error fetching filter options:', err);
        setFilterOptions({
          divisions: [],
          salespeople: [],
          access_level: null
        });
      } finally {
        setLoadingOptions(false);
      }
    };

    fetchFilterOptions();
  }, [filters.division]);

  // Auto-fetch report data when filters change
  useEffect(() => {
    const fetchReportData = async () => {
      // Don't fetch if no financial year is selected
      if (!filters.fy) {
        return;
      }

      setLoading(true);
      setError('');
      
      try {
        const data = await reportsApi.getTargetVsActualsReport(filters);
        setReportData(data);
      } catch (err) {
        setError(err.message || 'Failed to fetch report data');
        setReportData({});
      } finally {
        setLoading(false);
      }
    };

    fetchReportData();
  }, [filters]);

  // Fetch customer data when showCustomerLevel is true and filters change
  useEffect(() => {
    const fetchCustomerData = async () => {
      if (!showCustomerLevel || !filters.fy) {
        setCustomerData({});
        return;
      }

      setLoading(true);
      setError('');
      
      try {
        const data = await reportsApi.getCustomerWiseReport(filters);
        setCustomerData(data);
      } catch (err) {
        setError(err.message || 'Failed to fetch customer data');
        setCustomerData({});
      } finally {
        setLoading(false);
      }
    };

    fetchCustomerData();
  }, [filters, showCustomerLevel]);

  // Switch to table view when customer level is shown
  useEffect(() => {
    if (showCustomerLevel) {
      setViewMode('table');
    }
  }, [showCustomerLevel]);

  // Handle filter changes
  const handleFilterChange = (field, value) => {
    setFilters(prev => {
      const newFilters = { ...prev, [field]: value };
      
      // Reset dependent fields when parent fields change
      if (field === 'fy') {
        // Reset all other filters when FY changes
        newFilters.division = '';
        newFilters.salesperson = '';
      } else if (field === 'division') {
        newFilters.salesperson = '';
      }
      
      return newFilters;
    });
  };

  // Get all months in Indian financial year order (April to March)
  const allMonths = useMemo(() => {
    return ["APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC", "JAN", "FEB", "MAR"];
  }, []);

  // Calculate totals
  const totals = useMemo(() => {
    const pyTotal = allMonths.reduce((total, month) => {
      return total + (reportData[month]?.PY || 0);
    }, 0);

    const targetTotal = allMonths.reduce((total, month) => {
      return total + (reportData[month]?.TARGET || 0);
    }, 0);
    
    const actualsTotal = allMonths.reduce((total, month) => {
      return total + (reportData[month]?.ACTUALS || 0);
    }, 0);
    
    return {
      PY: pyTotal,
      TARGET: targetTotal,
      ACTUALS: actualsTotal
    };
  }, [reportData, allMonths]);

  // Calculate quarterly totals
  const quarterlyTotals = useMemo(() => {
    const quarters = {
      Q1: ["APR", "MAY", "JUN"],
      Q2: ["JUL", "AUG", "SEP"], 
      Q3: ["OCT", "NOV", "DEC"],
      Q4: ["JAN", "FEB", "MAR"]
    };

    const quarterlyData = {};
    
    Object.keys(quarters).forEach(quarter => {
      const quarterMonths = quarters[quarter];
      
      const pySum = quarterMonths.reduce((sum, month) => {
        return sum + (reportData[month]?.PY || 0);
      }, 0);

      const targetSum = quarterMonths.reduce((sum, month) => {
        return sum + (reportData[month]?.TARGET || 0);
      }, 0);
      
      const actualsSum = quarterMonths.reduce((sum, month) => {
        return sum + (reportData[month]?.ACTUALS || 0);
      }, 0);
      
      quarterlyData[quarter] = {
        PY: pySum,
        TARGET: targetSum,
        ACTUALS: actualsSum
      };
    });
    
    return quarterlyData;
  }, [reportData]);

  // Prepare data for charts
  const chartData = useMemo(() => {
    if (!reportData || Object.keys(reportData).length === 0) return [];

    return allMonths.map(month => ({
      month,
      'Previous Year': reportData[month]?.PY || 0,
      'Target (CY)': reportData[month]?.TARGET || 0,
      'Actual (CY)': reportData[month]?.ACTUALS || 0
    }));
  }, [reportData, allMonths]);

  // Prepare customer data for table display with new format
  const processedCustomerData = useMemo(() => {
    if (!customerData || Object.keys(customerData).length === 0) {
      return {
        kab: [],
        existing: [],
        new: { target: 0, customers: [] }
      };
    }

    // Process KAB (Key Account Business) data
    const kabData = [];
    if (customerData.KAB) {
      const allKabCustomers = new Set();
      
      // Get all unique customers from KAB
      Object.keys(customerData.KAB).forEach(month => {
        if (customerData.KAB[month]) {
          Object.keys(customerData.KAB[month]).forEach(customer => {
            allKabCustomers.add(customer);
          });
        }
      });

      // Create table rows for each KAB customer
      allKabCustomers.forEach(customer => {
        const customerRow = { customer, type: 'KAB' };
        
        // Add data for each month
        allMonths.forEach(month => {
          const monthData = customerData.KAB?.[month]?.[customer];
          customerRow[month] = {
            target: monthData?.Target || 0,
            actuals: monthData?.Actuals || 0
          };
        });

        // Calculate totals
        customerRow.totals = allMonths.reduce((acc, month) => {
          acc.target += customerRow[month].target;
          acc.actuals += customerRow[month].actuals;
          return acc;
        }, { target: 0, actuals: 0 });

        kabData.push(customerRow);
      });
    }

    // Process EXISTING customers data
    const existingData = [];
    if (customerData.EXISTING) {
      const allExistingCustomers = new Set();
      
      // Get all unique customers from EXISTING
      Object.keys(customerData.EXISTING).forEach(month => {
        if (customerData.EXISTING[month]) {
          Object.keys(customerData.EXISTING[month]).forEach(customer => {
            allExistingCustomers.add(customer);
          });
        }
      });

      // Create table rows for each existing customer
      allExistingCustomers.forEach(customer => {
        const customerRow = { customer, type: 'EXISTING' };
        
        // Add data for each month (only actuals for existing customers)
        allMonths.forEach(month => {
          const actualValue = customerData.EXISTING?.[month]?.[customer] || 0;
          customerRow[month] = {
            target: 0, // No targets for existing customers
            actuals: actualValue
          };
        });

        // Calculate totals
        customerRow.totals = allMonths.reduce((acc, month) => {
          acc.target += 0; // No targets
          acc.actuals += customerRow[month].actuals;
          return acc;
        }, { target: 0, actuals: 0 });

        existingData.push(customerRow);
      });
    }

    // Process NEW customers data
    const newCustomersData = { target: 0, customers: [] };
    if (customerData.NEW) {
      newCustomersData.target = customerData.NEW.Target || 0;
      
      if (customerData.NEW.Actuals) {
        const allNewCustomers = new Set();
        
        // Get all unique customers from NEW.Actuals
        Object.keys(customerData.NEW.Actuals).forEach(month => {
          if (customerData.NEW.Actuals[month]) {
            Object.keys(customerData.NEW.Actuals[month]).forEach(customer => {
              allNewCustomers.add(customer);
            });
          }
        });

        // Create table rows for each new customer
        allNewCustomers.forEach(customer => {
          const customerRow = { customer, type: 'NEW' };
          
          // Add data for each month (only actuals for new customers)
          allMonths.forEach(month => {
            const actualValue = customerData.NEW.Actuals?.[month]?.[customer] || 0;
            customerRow[month] = {
              target: 0, // Individual targets not available
              actuals: actualValue
            };
          });

          // Calculate totals
          customerRow.totals = allMonths.reduce((acc, month) => {
            acc.target += 0; // No individual targets
            acc.actuals += customerRow[month].actuals;
            return acc;
          }, { target: 0, actuals: 0 });

          newCustomersData.customers.push(customerRow);
        });
      }
    }

    return {
      kab: kabData.sort((a, b) => a.customer.localeCompare(b.customer)),
      existing: existingData.sort((a, b) => a.customer.localeCompare(b.customer)),
      new: newCustomersData
    };
  }, [customerData, allMonths]);

  // KAB Table Component
  const KABTable = () => (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="sticky left-0 bg-gray-50 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 z-10">
              Customer
            </th>
            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
              Total Target
            </th>
            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
              Total Actuals
            </th>
            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
              Achievement %
            </th>
            {allMonths.map(month => (
              <th key={month} className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                <div>{month}</div>
                <div className="text-xs text-gray-400 font-normal">T / A</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {processedCustomerData.kab.map((customer, index) => {
            const achievement = customer.totals.target > 0 
              ? ((customer.totals.actuals / customer.totals.target) * 100).toFixed(2)
              : '0.00';
            
            return (
              <tr key={index} className="hover:bg-gray-50">
                <td className="sticky left-0 bg-white px-6 py-4 text-sm font-medium text-gray-900 border-r border-gray-200 z-10">
                  <div className="max-w-xs truncate" title={customer.customer}>
                    {customer.customer}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center font-semibold bg-blue-50 border-r border-gray-200">
                  {customer.totals.target.toFixed(2)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center font-semibold bg-green-50 border-r border-gray-200">
                  {customer.totals.actuals.toFixed(2)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center font-semibold bg-yellow-50 border-r border-gray-200">
                  {achievement}%
                </td>
                {allMonths.map(month => (
                  <td key={`${customer.customer}-${month}`} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center border-r border-gray-200">
                    <div className="space-y-1">
                      <div className="text-blue-600">
                        {customer[month].target.toFixed(2)}
                      </div>
                      <div className="text-green-600">
                        {customer[month].actuals.toFixed(2)}
                      </div>
                    </div>
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  // Existing Customers Table Component
  const ExistingCustomersTable = () => (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="sticky left-0 bg-gray-50 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 z-10">
              Customer
            </th>
            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
              Total Actuals
            </th>
            {allMonths.map(month => (
              <th key={month} className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                {month}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {processedCustomerData.existing.map((customer, index) => (
            <tr key={index} className="hover:bg-gray-50">
              <td className="sticky left-0 bg-white px-6 py-4 text-sm font-medium text-gray-900 border-r border-gray-200 z-10">
                <div className="max-w-xs truncate" title={customer.customer}>
                  {customer.customer}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center font-semibold bg-green-50 border-r border-gray-200">
                {customer.totals.actuals.toFixed(2)}
              </td>
              {allMonths.map(month => (
                <td key={`${customer.customer}-${month}`} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center border-r border-gray-200">
                  {customer[month].actuals.toFixed(2)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  // New Customers Table Component
  const NewCustomersTable = () => {
    const totalActuals = processedCustomerData.new.customers.reduce((sum, customer) => {
      return sum + customer.totals.actuals;
    }, 0);
    
    const achievement = processedCustomerData.new.target > 0 
      ? ((totalActuals / processedCustomerData.new.target) * 100).toFixed(2)
      : '0.00';

    return (
      <div>
        {/* Overall Target Summary */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {processedCustomerData.new.target.toFixed(2)}
              </div>
              <div className="text-sm text-gray-600">Overall Target</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {totalActuals.toFixed(2)}
              </div>
              <div className="text-sm text-gray-600">Total Actuals</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {achievement}%
              </div>
              <div className="text-sm text-gray-600">Achievement</div>
            </div>
          </div>
        </div>

        {/* Customer Details Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="sticky left-0 bg-gray-50 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 z-10">
                  Customer
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                  Total Actuals
                </th>
                {allMonths.map(month => (
                  <th key={month} className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                    {month}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {processedCustomerData.new.customers.map((customer, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="sticky left-0 bg-white px-6 py-4 text-sm font-medium text-gray-900 border-r border-gray-200 z-10">
                    <div className="max-w-xs truncate" title={customer.customer}>
                      {customer.customer}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center font-semibold bg-green-50 border-r border-gray-200">
                    {customer.totals.actuals.toFixed(2)}
                  </td>
                  {allMonths.map(month => (
                    <td key={`${customer.customer}-${month}`} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center border-r border-gray-200">
                      {customer[month].actuals.toFixed(2)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const handleDownloadExcel = () => {
    try {
      // Use the dedicated Target vs Actuals export function
      exportTargetVsActualsToExcel(reportData, totals, allMonths);
    } catch (error) {
      setError('Failed to download Excel file. Please try again.');
      console.error('Error downloading Excel:', error);
    }
  };

  return (
    <div className="p-6 h-full overflow-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Target vs Actuals Report (Key Account & New Businesses)</h1>
        <p className="text-gray-600">Compare targets and actuals across divisions and salespersons</p>
      </div>

      {/* Filter Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Filters</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Financial Year Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Financial Year
            </label>
            <select
              value={filters.fy}
              onChange={(e) => handleFilterChange('fy', e.target.value)}
              disabled={loadingFY}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
            >
              {financialYears.map(year => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          {/* Division Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Division
            </label>
            <select
              value={filters.division}
              onChange={(e) => handleFilterChange('division', e.target.value)}
              disabled={loadingOptions || !filters.fy}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
            >
              {!filters.fy && (
                <option value="">Select FY first</option>
              )}
              {filters.fy && filterOptions.access_level === 'A' && (
                <option value="">All Divisions</option>
              )}
              {filters.fy && filterOptions.divisions.map(division => (
                <option key={division.code} value={division.code}>
                  {getDivisionLabel(division.code || division.name)}
                </option>
              ))}
            </select>
          </div>

          {/* Salesperson Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Salesperson
            </label>
            <select
              value={filters.salesperson}
              onChange={(e) => handleFilterChange('salesperson', e.target.value)}
              disabled={loadingOptions || !filters.fy || filterOptions.salespeople.length === 0}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
            >
              {!filters.fy && (
                <option value="">Select FY first</option>
              )}
              {filters.fy && (loadingOptions || 
                filterOptions.salespeople.length === 0 || 
                ['A', 'D', 'Z', 'C'].includes(filterOptions.access_level)) && (
                <option value="">
                  {loadingOptions ? 'Loading...' : 
                   filterOptions.salespeople.length === 0 ? 'No salespersons available' : 'All Salespersons'}
                </option>
              )}
              {filters.fy && filterOptions.salespeople.map(person => (
                <option key={person.ECode} value={person.ECode}>
                  {person.Name} ({person.ECode})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Loading Filter Options Indicator */}
      {loadingOptions && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
          <div className="flex items-center">
            <svg className="animate-spin h-4 w-4 text-blue-600 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-blue-800">Loading filter options...</p>
          </div>
        </div>
      )}

      {/* Loading Report Data Indicator */}
      {loading && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
          <div className="flex items-center">
            <svg className="animate-spin h-4 w-4 text-blue-600 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-blue-800">Loading report data...</p>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
          <div className="flex">
            <svg className="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <p className="text-red-800">{error}</p>
          </div>
        </div>
      )}

      {/* View Toggle and Report Content */}
      {(Object.keys(reportData).length > 0 || (showCustomerLevel && Object.keys(customerData).length > 0)) && (
        <>
          {/* View Toggle Header */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Target vs Actuals Report (in lakhs)
                </h2>
              </div>

              <div className="flex items-center gap-3">
                {/* View Mode Toggle - Hidden for customer level */}
                {!showCustomerLevel && (
                  <div className="flex bg-gray-100 rounded-lg p-1">
                    <button
                      onClick={() => setViewMode('table')}
                      className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                        viewMode === 'table'
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-600 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      Table
                    </button>
                    <button
                      onClick={() => setViewMode('graph')}
                      className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                        viewMode === 'graph'
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-600 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      Graph
                    </button>
                  </div>
                )}

                {/* Chart Type Selector (only for graph view and not customer level) */}
                {viewMode === 'graph' && !showCustomerLevel && (
                  <select
                    value={chartType}
                    onChange={(e) => setChartType(e.target.value)}
                    className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="line">Line Chart</option>
                    <option value="bar">Bar Chart</option>
                  </select>
                )}

                {/* Show Customer Level Button */}
                <button
                  onClick={() => setShowCustomerLevel(!showCustomerLevel)}
                  className={`px-4 py-2 rounded-lg transition-colors flex items-center text-sm ${
                    showCustomerLevel
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  {showCustomerLevel ? 'Hide Customer Level' : 'Show Customer Level'}
                </button>

                {/* Download Button */}
                <button
                  onClick={handleDownloadExcel}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center text-sm"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download Excel
                </button>
              </div>
            </div>
          </div>

          {/* Report Content */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {viewMode === 'table' ? (
              /* Table View */
              <div className="overflow-x-auto">
                {showCustomerLevel ? (
                  /* Customer Level with Tabs */
                  <div>
                    {/* Tab Navigation */}
                    <div className="border-b border-gray-200">
                      <nav className="flex space-x-8 px-6" aria-label="Tabs">
                        <button
                          onClick={() => setActiveCustomerTab('kab')}
                          className={`py-4 px-1 border-b-2 font-medium text-sm ${
                            activeCustomerTab === 'kab'
                              ? 'border-blue-500 text-blue-600'
                              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                          }`}
                        >
                          Key Account Business
                          {processedCustomerData.kab.length > 0 && (
                            <span className="ml-2 bg-gray-100 text-gray-900 py-0.5 px-2.5 rounded-full text-xs">
                              {processedCustomerData.kab.length}
                            </span>
                          )}
                        </button>
                        <button
                          onClick={() => setActiveCustomerTab('existing')}
                          className={`py-4 px-1 border-b-2 font-medium text-sm ${
                            activeCustomerTab === 'existing'
                              ? 'border-blue-500 text-blue-600'
                              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                          }`}
                        >
                        Existing Customers (New Business)
                          {processedCustomerData.existing.length > 0 && (
                            <span className="ml-2 bg-gray-100 text-gray-900 py-0.5 px-2.5 rounded-full text-xs">
                              {processedCustomerData.existing.length}
                            </span>
                          )}
                        </button>
                        <button
                          onClick={() => setActiveCustomerTab('new')}
                          className={`py-4 px-1 border-b-2 font-medium text-sm ${
                            activeCustomerTab === 'new'
                              ? 'border-blue-500 text-blue-600'
                              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                          }`}
                        >
                          New Customers (New Business)
                          {processedCustomerData.new.customers.length > 0 && (
                            <span className="ml-2 bg-gray-100 text-gray-900 py-0.5 px-2.5 rounded-full text-xs">
                              {processedCustomerData.new.customers.length}
                            </span>
                          )}
                        </button>
                      </nav>
                    </div>

                    {/* Tab Content */}
                    <div className="p-6">
                      {activeCustomerTab === 'kab' && <KABTable />}
                      {activeCustomerTab === 'existing' && <ExistingCustomersTable />}
                      {activeCustomerTab === 'new' && <NewCustomersTable />}
                    </div>
                  </div>
                ) : (
                  /* Regular Summary Table */
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                          Type
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                          Total
                        </th>
                        {allMonths.map(month => (
                          <th key={month} className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                            {month}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {/* Previous Year Row */}
                      <tr className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 border-r border-gray-200">
                          Actual (PY)
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center font-semibold bg-blue-50 border-r border-gray-200">
                          {totals.PY.toFixed(2)}
                        </td>
                        {allMonths.map(month => (
                          <td key={`py-${month}`} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center border-r border-gray-200">
                            {(reportData[month]?.PY || 0).toFixed(2)}
                          </td>
                        ))}
                      </tr>

                      {/* Target Row */}
                      <tr className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 border-r border-gray-200">
                          Target (CY)
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center font-semibold bg-blue-50 border-r border-gray-200">
                          {totals.TARGET.toFixed(2)}
                        </td>
                        {allMonths.map(month => (
                          <td key={`target-${month}`} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center border-r border-gray-200">
                            {(reportData[month]?.TARGET || 0).toFixed(2)}
                          </td>
                        ))}
                      </tr>
                      
                      {/* Actuals Row */}
                      <tr className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 border-r border-gray-200">
                          Actual (CY)
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center font-semibold bg-blue-50 border-r border-gray-200">
                          {totals.ACTUALS.toFixed(2)}
                        </td>
                        {allMonths.map(month => (
                          <td key={`actuals-${month}`} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center border-r border-gray-200">
                            {(reportData[month]?.ACTUALS || 0).toFixed(2)}
                          </td>
                        ))}
                      </tr>
                      
                
                      {/* YoY Growth (₹) Row */}
                      <tr className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 border-r border-gray-200">
                          YoY Growth (₹)
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center font-semibold border-r border-gray-200 bg-blue-50">
                          {(() => {
                            if (totals.ACTUALS === 0) return '-';
                            const growth = totals.ACTUALS - totals.PY;
                            const textColor = growth >= 0 ? 'text-green-600' : 'text-red-600';
                            return <span className={textColor}>{growth.toFixed(2)}</span>;
                          })()}
                        </td>
                        {allMonths.map(month => {
                          const actuals = reportData[month]?.ACTUALS || 0;
                          const py = reportData[month]?.PY || 0;
                          
                          if (actuals === 0) {
                            return (
                              <td key={`yoy-rupees-${month}`} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center border-r border-gray-200">
                                -
                              </td>
                            );
                          }
                          
                          const growth = actuals - py;
                          const textColor = growth >= 0 ? 'text-green-600' : 'text-red-600';
                          
                          return (
                            <td key={`yoy-rupees-${month}`} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center border-r border-gray-200">
                              <span className={textColor}>{growth.toFixed(2)}</span>
                            </td>
                          );
                        })}
                      </tr>

                      {/* YoY Growth (%) Row */}
                      <tr className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 border-r border-gray-200">
                          YoY Growth (%)
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center font-semibold border-r border-gray-200 bg-blue-50">
                          {(() => {
                            if (totals.ACTUALS === 0 || totals.PY === 0) return '-';
                            const growthPercent = ((totals.ACTUALS - totals.PY) / totals.PY) * 100;
                            const textColor = growthPercent >= 0 ? 'text-green-600' : 'text-red-600';
                            return <span className={textColor}>{growthPercent.toFixed(2)}%</span>;
                          })()}
                        </td>
                        {allMonths.map(month => {
                          const actuals = reportData[month]?.ACTUALS || 0;
                          const py = reportData[month]?.PY || 0;
                          
                          if (actuals === 0 || py === 0) {
                            return (
                              <td key={`yoy-percent-${month}`} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center border-r border-gray-200">
                                -
                              </td>
                            );
                          }
                          
                          const growthPercent = ((actuals - py) / py) * 100;
                          const textColor = growthPercent >= 0 ? 'text-green-600' : 'text-red-600';
                          
                          return (
                            <td key={`yoy-percent-${month}`} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center border-r border-gray-200">
                              <span className={textColor}>{growthPercent.toFixed(2)}%</span>
                            </td>
                          );
                        })}
                      </tr>

                         {/* Achievement Row */}
                         <tr className="hover:bg-gray-50 bg-green-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 border-r border-gray-200">
                          Achievement (%)
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center font-semibold bg-green-100 border-r border-gray-200">
                          {totals.TARGET > 0 ? ((totals.ACTUALS / totals.TARGET) * 100).toFixed(2) : '0.00'}%
                        </td>
                        {allMonths.map(month => {
                          const target = reportData[month]?.TARGET || 0;
                          const actuals = reportData[month]?.ACTUALS || 0;
                          const achievement = target > 0 ? ((actuals / target) * 100).toFixed(2) : '0.00';
                          
                          return (
                            <td key={`achievement-${month}`} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center border-r border-gray-200">
                              {achievement}%
                            </td>
                          );
                        })}
                      </tr>

                    </tbody>
                  </table>
                )}
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
                          formatter={(value, name) => [value?.toFixed(2), name]}
                          labelFormatter={(label) => `Month: ${label}`}
                        />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="Previous Year"
                          stroke="#8B5CF6"
                          strokeWidth={2}
                          dot={{ r: 4 }}
                          connectNulls={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="Target (CY)"
                          stroke="#3B82F6"
                          strokeWidth={2}
                          dot={{ r: 4 }}
                          connectNulls={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="Actual (CY)"
                          stroke="#10B981"
                          strokeWidth={2}
                          dot={{ r: 4 }}
                          connectNulls={false}
                        />
                      </LineChart>
                    )}
                    {chartType === 'bar' && (
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip 
                          formatter={(value, name) => [value?.toFixed(2), name]}
                          labelFormatter={(label) => `Month: ${label}`}
                        />
                        <Legend />
                        <Bar dataKey="Previous Year" fill="#8B5CF6" />
                        <Bar dataKey="Target (CY)" fill="#3B82F6" />
                        <Bar dataKey="Actual (CY)" fill="#10B981" />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Quarterly Summary */}
      {!showCustomerLevel && Object.keys(reportData).length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mt-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Quarterly Summary (in lakhs)</h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                    Type
                  </th>
                  {["Q1", "Q2", "Q3", "Q4"].map(quarter => (
                    <th key={quarter} className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                      {quarter}
                      <div className="text-xs text-gray-400 font-normal mt-1">
                        {quarter === "Q1" && "Apr-Jun"}
                        {quarter === "Q2" && "Jul-Sep"}
                        {quarter === "Q3" && "Oct-Dec"}
                        {quarter === "Q4" && "Jan-Mar"}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {/* Previous Year Row */}
                <tr className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 border-r border-gray-200">
                    Actual (PY)
                  </td>
                  {["Q1", "Q2", "Q3", "Q4"].map(quarter => (
                    <td key={`py-${quarter}`} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center border-r border-gray-200 ">
                      {(quarterlyTotals[quarter]?.PY || 0).toFixed(2)}
                    </td>
                  ))}
                </tr>

                {/* Target Row */}
                <tr className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 border-r border-gray-200">
                    Target (CY)
                  </td>
                  {["Q1", "Q2", "Q3", "Q4"].map(quarter => (
                    <td key={`target-${quarter}`} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center border-r border-gray-200">
                      {(quarterlyTotals[quarter]?.TARGET || 0).toFixed(2)}
                    </td>
                  ))}
                </tr>
                
                {/* Actuals Row */}
                <tr className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 border-r border-gray-200">
                    Actual (CY)
                  </td>
                  {["Q1", "Q2", "Q3", "Q4"].map(quarter => (
                    <td key={`actuals-${quarter}`} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center border-r border-gray-200">
                      {(quarterlyTotals[quarter]?.ACTUALS || 0).toFixed(2)}
                    </td>
                  ))}
                </tr>
                
              

                  {/* YoY Growth (₹) Row */}
                  <tr className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 border-r border-gray-200">
                      YoY Growth (₹)
                    </td>
                    {["Q1", "Q2", "Q3", "Q4"].map(quarter => {
                      const actuals = quarterlyTotals[quarter]?.ACTUALS || 0;
                      const py = quarterlyTotals[quarter]?.PY || 0;
                      
                      if (actuals === 0) {
                        return (
                          <td key={`yoy-rupees-${quarter}`} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center border-r border-gray-200">
                            -
                          </td>
                        );
                      }
                      
                      const growth = actuals - py;
                      const textColor = growth >= 0 ? 'text-green-600' : 'text-red-600';
                      
                      return (
                        <td key={`yoy-rupees-${quarter}`} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center border-r border-gray-200">
                          <span className={textColor}>{growth.toFixed(2)}</span>
                        </td>
                      );
                    })}
                  </tr>

                  {/* YoY Growth (%) Row */}
                  <tr className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 border-r border-gray-200">
                      YoY Growth (%)
                    </td>
                    {["Q1", "Q2", "Q3", "Q4"].map(quarter => {
                      const actuals = quarterlyTotals[quarter]?.ACTUALS || 0;
                      const py = quarterlyTotals[quarter]?.PY || 0;
                      
                      if (actuals === 0 || py === 0) {
                        return (
                          <td key={`yoy-percent-${quarter}`} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center border-r border-gray-200">
                            -
                          </td>
                        );
                      }
                      
                      const growthPercent = ((actuals - py) / py) * 100;
                      const textColor = growthPercent >= 0 ? 'text-green-600' : 'text-red-600';
                      
                      return (
                        <td key={`yoy-percent-${quarter}`} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center border-r border-gray-200">
                          <span className={textColor}>{growthPercent.toFixed(2)}%</span>
                        </td>
                      );
                    })}
                  </tr>

                                      {/* Achievement Row */}
                                      <tr className="hover:bg-gray-50 bg-green-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 border-r border-gray-200">
                      Achievement (%)
                    </td>
                    {["Q1", "Q2", "Q3", "Q4"].map(quarter => {
                      const target = quarterlyTotals[quarter]?.TARGET || 0;
                      const actuals = quarterlyTotals[quarter]?.ACTUALS || 0;
                      const achievement = target > 0 ? ((actuals / target) * 100).toFixed(2) : '0.00';
                      
                      return (
                        <td key={`achievement-${quarter}`} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center border-r border-gray-200 bg-green-50">
                          {achievement}%
                        </td>
                      );
                    })}
                  </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* No Data Message */}
      {!loading && 
       ((showCustomerLevel && Object.keys(customerData).length === 0) || 
        (!showCustomerLevel && Object.keys(reportData).length === 0)) && 
       !error && (
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Report Data</h3>
          <p className="text-gray-600">Select filters to load target vs actuals data.</p>
        </div>
      )}
    </div>
  );
};

export default TargetVsActualsReport;
