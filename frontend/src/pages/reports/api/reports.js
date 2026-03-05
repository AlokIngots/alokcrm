const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

/**
 * Parse error response from the API
 * @param {Response} response - The fetch response object
 * @returns {Promise<string>} Error message
 */
const parseErrorResponse = async (response) => {
  try {
    const errorData = await response.json();
    
    // Handle FastAPI HTTPException format
    if (errorData.detail) {
      if (typeof errorData.detail === 'string') {
        return errorData.detail;
      }
      if (Array.isArray(errorData.detail)) {
        return errorData.detail.map(err => err.msg || err.message || JSON.stringify(err)).join(', ');
      }
      return JSON.stringify(errorData.detail);
    }
    
    return errorData.message || `HTTP error! status: ${response.status}`;
  } catch (parseError) {
    return `HTTP error! status: ${response.status}`;
  }
};

/**
 * Make authenticated request with JWT token
 * @param {string} url - The API endpoint URL
 * @param {Object} options - Fetch options
 * @returns {Promise<Response>} Fetch response
 */
const makeAuthenticatedRequest = async (url, options = {}) => {
  const token = localStorage.getItem('access_token');
  
  if (!token) {
    throw new Error('No authentication token found');
  }

  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
  });
};

export const reportsApi = {
  /**
   * Get financial years from the backend API
   * @returns {Promise<Array>} Array of financial years
   */
  getFinancialYears: async () => {
    try {
      const url = `${API_BASE_URL}/api/v1/targets/financial-years`;
      const response = await makeAuthenticatedRequest(url);
      
      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response);
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      
      // Handle different response formats
      if (Array.isArray(data)) {
        return data;
      } else if (data && Array.isArray(data.financial_years)) {
        return data.financial_years;
      } else if (data && Array.isArray(data.years)) {
        return data.years;
      } else if (data && typeof data === 'object' && data.data && Array.isArray(data.data)) {
        return data.data;
      } else {
        console.warn('Unexpected financial years response format:', data);
        return [];
      }
    } catch (error) {
      console.error('Error fetching financial years:', error);
      throw error;
    }
  },

  /**
   * Fetch activity report data from the backend API
   * @param {Object} filters - Filter parameters
   * @param {string} filters.fy - Financial year (required)
   * @param {string} filters.division - Division filter
   * @param {string} filters.zone - Zone filter
   * @param {string} filters.cluster - Cluster filter
   * @param {string} filters.salesperson - Salesperson filter
   * @param {string} filters.from_date - From date filter (ISO format)
   * @param {string} filters.to_date - To date filter (ISO format)
   * @returns {Promise<Object>} Activity report data by month and stage
   */
  getActivityReport: async (filters = {}) => {
    try {
      const queryParams = new URLSearchParams();
      
      // Add required fy parameter
      if (filters.fy) queryParams.append('fy', filters.fy);
      
      // Add filters to query params if they exist
      if (filters.division) queryParams.append('division', filters.division);
      if (filters.zone) queryParams.append('zone', filters.zone);
      if (filters.cluster) queryParams.append('cluster', filters.cluster);
      if (filters.salesperson) queryParams.append('salesperson', filters.salesperson);
      if (filters.from_date) queryParams.append('from', filters.from_date);
      if (filters.to_date) queryParams.append('to', filters.to_date);

      const url = `${API_BASE_URL}/api/v1/reports/sales-activity${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      const response = await makeAuthenticatedRequest(url);
      
      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response);
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching activity report:', error);
      throw error;
    }
  },

  /**
   * Fetch filter options (divisions, zones, clusters, salespeople) from the backend API
   * @param {Object} filters - Current filter values to get progressive options
   * @param {string} filters.division - Division code filter
   * @param {string} filters.zone - Zone code filter  
   * @param {string} filters.cluster - Cluster code filter
   * @returns {Promise<Object>} Filter options with codes and names
   */
  getFilterOptions: async (filters = {}) => {
    try {
      const queryParams = new URLSearchParams();
      
      if (filters.division) queryParams.append('division', filters.division);
      if (filters.zone) queryParams.append('zone', filters.zone);
      if (filters.cluster) queryParams.append('cluster', filters.cluster);

      const url = `${API_BASE_URL}/api/v1/users/filter-options${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      const response = await makeAuthenticatedRequest(url);
      
      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response);
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching filter options:', error);
      throw error;
    }
  },

  /**
   * Fetch users with optional filters
   * @param {Object} filters - Filter parameters
   * @param {string} filters.division - Division filter
   * @param {string} filters.zone - Zone filter
   * @param {string} filters.cluster - Cluster filter
   * @returns {Promise<Array>} Array of user objects
   */
  getUsers: async (filters = {}) => {
    try {
      const queryParams = new URLSearchParams();
      
      // Add filters to query params if they exist
      if (filters.division) queryParams.append('division', filters.division);
      if (filters.zone) queryParams.append('zone', filters.zone);
      if (filters.cluster) queryParams.append('cluster', filters.cluster);

      const url = `${API_BASE_URL}/api/v1/users/${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      const response = await makeAuthenticatedRequest(url);
      
      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response);
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('Error fetching users:', error);
      throw error;
    }
  },

  /**
   * Fetch target vs actuals report data from the backend API
   * @param {Object} filters - Filter parameters
   * @param {string} filters.fy - Financial year (required)
   * @param {string} filters.division - Division filter
   * @param {string} filters.zone - Zone filter
   * @param {string} filters.cluster - Cluster filter
   * @param {string} filters.salesperson - Salesperson filter
   * @returns {Promise<Object>} Target vs actuals report data by month
   */
  getTargetVsActualsReport: async (filters = {}) => {
    try {
      const queryParams = new URLSearchParams();
      
      // Add required fy parameter
      if (filters.fy) queryParams.append('fy', filters.fy);
      
      // Add filters to query params if they exist
      if (filters.division) queryParams.append('division', filters.division);
      if (filters.zone) queryParams.append('zone', filters.zone);
      if (filters.cluster) queryParams.append('cluster', filters.cluster);
      if (filters.salesperson) queryParams.append('salesperson', filters.salesperson);

      const url = `${API_BASE_URL}/api/v1/reports/target-vs-actuals${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      const response = await makeAuthenticatedRequest(url);
      
      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response);
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching target vs actuals report:', error);
      throw error;
    }
  },

  /**
   * Fetch customer-wise target vs actuals report data from the backend API
   * @param {Object} filters - Filter parameters
   * @param {string} filters.fy - Financial year (required)
   * @param {string} filters.division - Division filter
   * @param {string} filters.zone - Zone filter
   * @param {string} filters.cluster - Cluster filter
   * @param {string} filters.salesperson - Salesperson filter
   * @returns {Promise<Object>} Customer-wise target vs actuals report data by month
   */
  getCustomerWiseReport: async (filters = {}) => {
    try {
      const queryParams = new URLSearchParams();
      
      // Add required fy parameter
      if (filters.fy) queryParams.append('fy', filters.fy);
      
      // Add filters to query params if they exist
      if (filters.division) queryParams.append('division', filters.division);
      if (filters.zone) queryParams.append('zone', filters.zone);
      if (filters.cluster) queryParams.append('cluster', filters.cluster);
      if (filters.salesperson) queryParams.append('salesperson', filters.salesperson);

      const url = `${API_BASE_URL}/api/v1/reports/customer-wise${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      const response = await makeAuthenticatedRequest(url);
      
      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response);
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching customer-wise report:', error);
      throw error;
    }
  }
}; 