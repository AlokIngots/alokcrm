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

export const adminDealsApi = {
  /**
   * Comprehensive deal edit for MD Office users
   * @param {number} dealId - ID of the deal to edit
   * @param {Object} dealData - Deal data to update (all fields optional)
   * @returns {Promise<Object>} Updated deal object with metadata
   */
  editDeal: async (dealId, dealData) => {
    try {
      console.log('Editing deal via admin endpoint:', dealId, dealData);
      
      const response = await makeAuthenticatedRequest(`${API_BASE_URL}/api/v1/deals/${dealId}/admin-edit`, {
        method: 'PATCH',
        body: JSON.stringify(dealData),
      });

      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response);
        throw new Error(errorMessage);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error editing deal via admin endpoint:', error);
      throw error;
    }
  },

  /**
   * Edit activity log dates for MD Office users
   * @param {number} dealId - ID of the deal whose activity logs to edit
   * @param {Array} dateEdits - Array of { activity_log_id, new_created_at } objects
   * @returns {Promise<Object>} Updated activity logs with metadata
   */
  editActivityLogDates: async (dealId, dateEdits) => {
    try {
      console.log('Editing activity log dates:', dealId, dateEdits);
      
      const response = await makeAuthenticatedRequest(`${API_BASE_URL}/api/v1/deals/${dealId}/activity-logs/edit-dates`, {
        method: 'PATCH',
        body: JSON.stringify({ date_edits: dateEdits }),
      });

      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response);
        throw new Error(errorMessage);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error editing activity log dates:', error);
      throw error;
    }
  }
}; 