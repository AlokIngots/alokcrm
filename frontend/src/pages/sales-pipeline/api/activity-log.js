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

export const activityLogApi = {
  /**
   * Create a new activity log entry with optional stage change information
   * @param {number} dealId - ID of the deal
   * @param {string} action - Description of the action performed
   * @param {string} stageFrom - Optional: Previous stage (for stage changes)
   * @param {string} stageTo - Optional: New stage (for stage changes)
   * @returns {Promise<Object>} Created activity log entry
   */
  createActivityLog: async (dealId, action, stageFrom = null, stageTo = null) => {
    try {
      const payload = {
        DealID: dealId,
        Action: action
      };

      // Add stage fields if provided
      if (stageFrom !== null) {
        payload.StageFrom = stageFrom;
      }
      if (stageTo !== null) {
        payload.StageTo = stageTo;
      }

      const response = await makeAuthenticatedRequest(`${API_BASE_URL}/api/v1/activity-log/`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response);
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
      console.error('Error creating activity log:', error);
      throw error;
    }
  },

  /**
   * Get activity logs with optional filters
   * @param {Object} filters - Filter options
   * @param {number} filters.dealId - Filter by deal ID
   * @param {string} filters.userEcode - Filter by user ECode
   * @param {number} filters.days - Filter by last N days
   * @param {boolean} filters.stageChangesOnly - Filter to show only stage change logs
   * @returns {Promise<Array>} Array of activity log entries
   */
  getActivityLogs: async (filters = {}) => {
    try {
      const params = new URLSearchParams();
      
      if (filters.dealId) {
        params.append('deal_id', filters.dealId);
      }
      if (filters.userEcode) {
        params.append('user_ecode', filters.userEcode);
      }
      if (filters.days) {
        params.append('days', filters.days);
      }
      if (filters.stageChangesOnly) {
        params.append('stage_changes_only', 'true');
      }

      const url = `${API_BASE_URL}/api/v1/activity-log/${params.toString() ? `?${params.toString()}` : ''}`;
      
      const response = await makeAuthenticatedRequest(url);

      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response);
        throw new Error(errorMessage);
      }

      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('Error fetching activity logs:', error);
      throw error;
    }
  }
};