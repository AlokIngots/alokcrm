import React, { useState, useEffect, useMemo } from 'react';
import { reportsApi } from './api/reports';
import { PIPELINE_STAGES } from '../../config/pipeline-stages';
import { exportReportsToExcel } from '../../utils/excelExport';
import { getDivisionLabel } from '../../config/divisions';

const SalesActivityReport = () => {
  // State for filters
  const [filters, setFilters] = useState({
    fy: '',
    division: '',
    salesperson: '',
    from_date: '',
    to_date: ''
  });

  // State for data
  const [reportData, setReportData] = useState({});
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
        const data = await reportsApi.getActivityReport(filters);
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

  // Handle date input changes
  const handleDateChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Get all pipeline stages in the correct order
  const allStages = useMemo(() => {
    return Object.keys(PIPELINE_STAGES);
  }, []);

  // Get all months in Indian financial year order (April to March)
  const allMonths = useMemo(() => {
    return ["APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC", "JAN", "FEB", "MAR"];
  }, []);

  // Calculate totals
  const stageTotals = useMemo(() => {
    const totals = {};
    
    // Calculate total for CREATED
    totals['CREATED'] = allMonths.reduce((total, month) => {
      return total + (reportData[month]?.['CREATED'] || 0);
    }, 0);
    
    // Calculate totals for all pipeline stages
    allStages.forEach(stage => {
      totals[stage] = allMonths.reduce((total, month) => {
        return total + (reportData[month]?.[stage] || 0);
      }, 0);
    });
    return totals;
  }, [reportData, allStages, allMonths]);

  const handleDownloadExcel = () => {
    try {
      exportReportsToExcel(reportData, stageTotals, allStages, allMonths, filters, PIPELINE_STAGES);
    } catch (error) {
      setError('Failed to download Excel file. Please try again.');
      console.error('Error downloading Excel:', error);
    }
  };

  return (
    <div className="p-6 h-full overflow-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Sales Activity Report</h1>
        <p className="text-gray-600">Track deal stage activity across divisions, salespersons, and time periods</p>
      </div>

      {/* Filter Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Filters</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
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

          {/* From Date Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              From Date
            </label>
            <input
              type="date"
              value={filters.from_date}
              onChange={(e) => handleDateChange('from_date', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* To Date Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              To Date
            </label>
            <input
              type="date"
              value={filters.to_date}
              onChange={(e) => handleDateChange('to_date', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
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


      {/* Report Table */}
      {Object.keys(reportData).length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {/* Table Header with Download Button */}
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">Sales Activity Report</h3>
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
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                    Deal Stage
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
                {/* CREATED Row */}
                <tr className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 border-r border-gray-200">
                    Deals Created
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center font-semibold bg-blue-50 border-r border-gray-200">
                    {stageTotals['CREATED']}
                  </td>
                  {allMonths.map(month => (
                    <td key={`CREATED-${month}`} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center border-r border-gray-200">
                      {reportData[month]?.['CREATED'] || 0}
                    </td>
                  ))}
                </tr>
                
                {/* Pipeline Stage Rows */}
                {allStages.map(stage => (
                  <tr key={stage} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 border-r border-gray-200">
                      {PIPELINE_STAGES[stage].title}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center font-semibold bg-blue-50 border-r border-gray-200">
                      {stageTotals[stage]}
                    </td>
                    {allMonths.map(month => (
                      <td key={`${stage}-${month}`} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center border-r border-gray-200">
                        {reportData[month]?.[stage] || 0}
                      </td>
                    ))}
                  </tr>
                ))}
                
                {/* Totals Row */}
               
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {/* No Data Message */}
      {!loading && Object.keys(reportData).length === 0 && !error && (
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Report Data</h3>
          <p className="text-gray-600">Click "Generate Report" to load data with the selected filters.</p>
        </div>
      )}
    </div>
  );
};

export default SalesActivityReport;
