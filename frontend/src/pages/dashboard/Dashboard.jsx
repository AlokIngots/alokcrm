import React, { useState, useEffect, useMemo } from 'react';
import { dashboardApi } from '../../modules/dashboard/api/dashboardApi';
import { PIPELINE_STAGES } from '../../config/pipeline-stages';
import { getDivisionLabel } from '../../config/divisions';

const Dashboard = () => {
  // State for filters
  const [filters, setFilters] = useState({
    fy: '',
    division: '',
    salesperson: ''
  });

  // State for data
  const [dashboardData, setDashboardData] = useState({
    stages: {
      stage_counts: {},
      stage_values: {},
      average_stage_times: {}
    },
    performance: {
      deals_won: 0,
      deals_lost: 0,
      year_target: 0,
      ytd_actuals: 0,
      month_target: 0,
      month_actuals: 0
    }
  });

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

  const fetchDashboardData = React.useCallback(async () => {
    if (!filters.fy) return;

    setLoading(true);
    setError('');
    try {
      const data = await dashboardApi.getDashboardSummary(filters);
      setDashboardData(data);
    } catch (err) {
      setError(err.message || 'Failed to fetch dashboard data');
      setDashboardData({
        stages: {
          stage_counts: {},
          stage_values: {},
          average_stage_times: {}
        },
        performance: {
          deals_won: 0,
          deals_lost: 0,
          year_target: 0,
          ytd_actuals: 0,
          month_target: 0,
          month_actuals: 0
        }
      });
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Fetch financial years on component mount
  useEffect(() => {
    const fetchFinancialYears = async () => {
      setLoadingFY(true);
      try {
        const years = await dashboardApi.getFinancialYears();
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
        const options = await dashboardApi.getFilterOptions({
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

  // Auto-fetch dashboard data when filters change
  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Auto-refresh when pipeline/deal data changes.
  useEffect(() => {
    const handleCrmDataUpdated = () => {
      fetchDashboardData();
    };
    const handleStorageUpdated = (event) => {
      if (event.key === 'crm:data-updated-at') {
        fetchDashboardData();
      }
    };

    window.addEventListener('crm:data-updated', handleCrmDataUpdated);
    window.addEventListener('storage', handleStorageUpdated);

    return () => {
      window.removeEventListener('crm:data-updated', handleCrmDataUpdated);
      window.removeEventListener('storage', handleStorageUpdated);
    };
  }, [fetchDashboardData]);

  // Poll as a fallback so dashboard stays fresh even without explicit events.
  useEffect(() => {
    const id = setInterval(() => {
      fetchDashboardData();
    }, 30000);
    return () => clearInterval(id);
  }, [fetchDashboardData]);

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

  // Format currency values
  const formatCurrency = (value) => {
    if (!value || value === 0) return '₹0';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Format currency values in lakhs/crores for pipeline values
  const formatCurrencyInLakhsCrores = (value) => {
    if (!value || value === 0) return '₹0';
    
    // Convert to lakhs first (value is already in rupees)
    const lakhs = value / 100000;
    
    if (lakhs < 100) {
      // Show as lakhs
      return `₹${lakhs.toFixed(2)} Lakhs`;
    } else {
      // Convert to crores and show
      const crores = lakhs / 100;
      return `₹${crores.toFixed(2)} Cr`;
    }
  };

  // Format numbers with commas
  const formatNumber = (value) => {
    if (!value || value === 0) return '0';
    return new Intl.NumberFormat('en-IN').format(value);
  };

  // Calculate progress percentage
  const calculateProgress = (actual, target) => {
    if (!target || target === 0) return 0;
    return Math.min((actual / target) * 100, 100);
  };

  // Calculate deal won percentage
  const calculateDealWonPercentage = useMemo(() => {
    const { deals_won, deals_lost } = dashboardData.performance;
    const totalClosedDeals = deals_won + deals_lost;
    if (totalClosedDeals === 0) return 0;
    return ((deals_won / totalClosedDeals) * 100).toFixed(1);
  }, [dashboardData.performance]);

  // Calculate totals for stage overview (excluding WON and LOST deals for active pipeline)
  const stageTotals = useMemo(() => {
    const { stage_counts, stage_values } = dashboardData.stages;
    
    // Calculate active pipeline (excluding DEAL_WON and DEAL_LOST)
    const activePipelineDeals = Object.entries(stage_counts)
      .filter(([stage]) => stage !== 'DEAL_WON' && stage !== 'DEAL_LOST')
      .reduce((sum, [, count]) => sum + count, 0);
      
    const activePipelineValue = Object.entries(stage_values)
      .filter(([stage]) => stage !== 'DEAL_WON' && stage !== 'DEAL_LOST')
      .reduce((sum, [, value]) => sum + value, 0);
    
    // Total pipeline including all stages
    const totalDeals = Object.values(stage_counts).reduce((sum, count) => sum + count, 0);
    const totalValue = Object.values(stage_values).reduce((sum, value) => sum + value, 0);
    
    return { 
      activePipelineDeals, 
      activePipelineValue, 
      totalDeals, 
      totalValue 
    };
  }, [dashboardData.stages]);

  // Enhanced Progress Indicator Component
  const ProgressCard = ({ title, actual, target, period }) => {
    const progress = calculateProgress(actual, target);
    
    
    const getGradientClass = (progress) => {
      if (progress >= 90) return 'from-green-500 to-emerald-600';
      if (progress >= 70) return 'from-yellow-500 to-amber-600';
      if (progress >= 50) return 'from-orange-500 to-red-500';
      return 'from-red-500 to-rose-600';
    };
   
    const gradientClass = getGradientClass(progress);
    
    return (
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-800">{title}</h3>
          </div>
          <p className="text-sm text-gray-600 mt-1">{period}</p>
        </div>
        
        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Target and Actual Values */}
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Target (in lakhs)</p>
              <p className="text-lg font-bold text-gray-900">{formatCurrency(target)}</p>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Actual (in lakhs)</p>
              <p className="text-lg font-bold text-blue-900">{formatCurrency(actual)}</p>
            </div>
          </div>
          
          {/* Progress Section */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-600">Achievement</span>
              <span className="text-lg font-bold text-gray-900">{progress.toFixed(1)}%</span>
            </div>
            
            {/* Enhanced Progress Bar */}
            <div className="relative">
              <div className="w-full bg-gray-200 rounded-full h-4 shadow-inner">
                <div 
                  className={`h-4 rounded-full bg-gradient-to-r ${gradientClass} transition-all duration-500 ease-out relative overflow-hidden`}
                  style={{ width: `${progress}%` }}
                >
                  {/* Shimmer effect */}
                  <div className="absolute inset-0 dddbg-gradient-to-r from-transparent via-white to-transparent opacity-20 animate-pulse"></div>
                </div>
              </div>
            </div>              
        </div>
        </div>
      </div>
    );
  };

  // Metric Card Component
  const MetricCard = ({ title, value, subtitle, icon, color = "blue" }) => {
    const colorClasses = {
      blue: "bg-blue-50 text-blue-600 border-blue-200",
      green: "bg-green-50 text-green-600 border-green-200",
      red: "bg-red-50 text-red-600 border-red-200",
      yellow: "bg-yellow-50 text-yellow-600 border-yellow-200",
      purple: "bg-purple-50 text-purple-600 border-purple-200"
    };

    return (
      <div className={`rounded-lg border p-6 ${colorClasses[color] || colorClasses.blue}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium opacity-80">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {subtitle && <p className="text-sm opacity-70 mt-1">{subtitle}</p>}
          </div>
          {icon && <div className="text-3xl opacity-50">{icon}</div>}
        </div>
      </div>
    );
  };

  // Enhanced Stage Card Component
  const StageCard = ({ stage, count, value, averageTime }) => {
    const stageInfo = PIPELINE_STAGES[stage] || { title: stage, color: 'bg-gray-50', headerColor: 'bg-gray-100' };
    
    // Extract color name from Tailwind class (e.g., 'bg-blue-50' -> 'blue')
    const isSinkStage = stage === 'DEAL_WON' || stage === 'DEAL_LOST';
    
    return (
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 h-full">
        {/* Header with stage name and color indicator */}
        <div className={`bg-blue-50 px-6 py-5 border-b border-gray-100`}>
          <div className="flex items-center justify-between">
            <h3 className="text-l font-bold text-gray-800">{stageInfo.title}</h3>
          </div>
        </div>
        
        {/* Metrics - Fixed height container */}
        <div className="p-6 h-64 flex flex-col justify-between">
          <div className="space-y-4">
            {/* Deals Count */}
            <div className="flex items-center justify-between py-2 px-4 rounded-xl bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-200">
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center mr-4">
                  <span className="text-gray-600 text-lg font-bold">#</span>
                </div>
                <span className="text-md font-semibold text-gray-700">Deals</span>
              </div>
              <span className="text-sm font-bold text-gray-900">{formatNumber(count || 0)}</span>
            </div>
            
            {/* Deal Value */}
            <div className="flex items-center justify-between py-2 px-4 rounded-xl bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-200">
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center mr-4">
                  <span className="text-gray-600 text-lg font-bold">₹</span>
                </div>
                <span className="text-md font-semibold text-gray-700">Value</span>
              </div>
              <span className="text-sm font-bold text-gray-900">{formatCurrencyInLakhsCrores(value || 0)}</span>
            </div>
            
            {/* Average Time or Spacer */}
            {!isSinkStage ? (
              <div className="flex items-center justify-between py-2 px-4 rounded-xl bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-200">
                <div className="flex items-center">
                  <div className="w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center mr-4">
                    <span className="text-gray-600 text-lg font-bold">⏱</span>
                  </div>
                  <span className="text-md font-semibold text-gray-700">Avg. Days</span>
                </div>
                <span className="text-sm font-bold text-gray-900">
                  {averageTime !== undefined ? `${averageTime}` : 'N/A'}
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-center p-2 rounded-xl bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-200">
                <div className="text-center">
                  <div className="text-3xl">{stage === 'DEAL_WON' ? '🏆' : '❌'}</div>

                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 h-full overflow-auto bg-gray-50">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Dashboard</h1>
        <p className="text-gray-600">Real-time insights into your sales performance and pipeline</p>
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
              {filters.fy && (filterOptions.salespeople.length === 0 || 
                ['A', 'D', 'Z', 'C'].includes(filterOptions.access_level)) && (
                <option value="">
                  {filterOptions.salespeople.length === 0 ? 'No salespeople available' : 'All Salespeople'}
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

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex">
            <div className="text-red-400">
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading dashboard data...</span>
        </div>
      )}

      {/* Dashboard Content */}
      {!loading && (
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            <MetricCard
              title="Active Pipeline Deals"
              value={formatNumber(stageTotals.activePipelineDeals)}
              subtitle="Deals in active pipeline"
              icon="📊"
              color="blue"
            />
            <MetricCard
              title="Active Pipeline Value"
              value={formatCurrencyInLakhsCrores(stageTotals.activePipelineValue)}
              subtitle="Value in active pipeline"
              icon="💰"
              color="blue"
            />
            <MetricCard
              title="Deals Won"
              value={formatNumber(dashboardData.performance.deals_won)}
              subtitle="Closed deals"
              icon="🏆"
              color="green"
            />
            <MetricCard
              title="Deals Lost"
              value={formatNumber(dashboardData.performance.deals_lost)}
              subtitle="Lost opportunities"
              icon="📉"
              color="red"
            />
            <MetricCard
              title="Win Rate"
              value={`${calculateDealWonPercentage}%`}
              subtitle="Deal success rate"
              icon="🎯"
              color="green"
            />
          </div>

          {/* Progress Indicators */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ProgressCard
              title="Year-to-Date Performance"
              actual={dashboardData.performance.ytd_actuals}
              target={dashboardData.performance.year_target}
              period="Current Financial Year"
            />
            <ProgressCard
              title="Monthly Performance"
              actual={dashboardData.performance.month_actuals}
              target={dashboardData.performance.month_target}
              period="Current Month"
            />
          </div>

          {/* Pipeline Stages Overview */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Pipeline Stages Overview</h2>
              <div className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                {Object.keys(PIPELINE_STAGES).length} Stages
              </div>
            </div>
            
            {/* Single row layout for all stages */}
            <div className="overflow-x-auto pb-4">
              <div className="flex space-x-6 min-w-max">
                {Object.keys(PIPELINE_STAGES).map(stage => (
                  <div key={stage} className="flex-shrink-0 w-72">
                    <StageCard
                      stage={stage}
                      count={dashboardData.stages.stage_counts[stage] || 0}
                      value={dashboardData.stages.stage_values[stage] || 0}
                      averageTime={dashboardData.stages.average_stage_times[stage]}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard; 
