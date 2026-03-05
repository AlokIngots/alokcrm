const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

/**
 * Parse error response from the API
 * @param {Response} response - The fetch response object
 * @returns {Promise<string>} Error message
 */
const parseErrorResponse = async (response) => {
  try {
    const errorData = await response.json();
    
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

export const activityLogSummaryApi = {
  /**
   * Get activity log summary - global activity across all deals
   * @param {Object} filters - Filter options
   * @param {string} filters.fromDate - Start date in ISO format (YYYY-MM-DD)
   * @param {string} filters.toDate - End date in ISO format (YYYY-MM-DD)
   * @returns {Promise<Array>} Array of activity log summary entries
   */
  getActivityLogSummary: async (filters = {}) => {
    try {
      const params = new URLSearchParams();
      
      if (filters.fromDate) {
        params.append('from_date', filters.fromDate);
      }
      if (filters.toDate) {
        params.append('to_date', filters.toDate);
      }

      const url = `${API_BASE_URL}/api/v1/activity-log/summary${params.toString() ? `?${params.toString()}` : ''}`;
      
      const response = await makeAuthenticatedRequest(url);

      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response);
        throw new Error(errorMessage);
      }

      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('Error fetching activity log summary:', error);
      throw error;
    }
  }
}; 