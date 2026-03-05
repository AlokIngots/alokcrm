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

export const dealStatusApi = {
  /**
   * Create a new deal status
   * @param {Object} dealStatusData - Deal status data to create
   * @returns {Promise<Object>} Created deal status object
   */
  createDealStatus: async (dealStatusData) => {
    try {
      const response = await makeAuthenticatedRequest(`${API_BASE_URL}/api/v1/deal-status/`, {
        method: 'POST',
        body: JSON.stringify(dealStatusData),
      });

      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response);
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
      console.error('Error creating deal status:', error);
      throw error;
    }
  },

  /**
   * Update an existing deal status
   * @param {number} statusId - ID of the deal status to update
   * @param {Object} dealStatusData - Deal status data to update
   * @returns {Promise<Object>} Updated deal status object
   */
  updateDealStatus: async (statusId, dealStatusData) => {
    try {
      const response = await makeAuthenticatedRequest(`${API_BASE_URL}/api/v1/deal-status/${statusId}`, {
        method: 'PUT',
        body: JSON.stringify(dealStatusData),
      });

      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response);
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
      console.error('Error updating deal status:', error);
      throw error;
    }
  },

  /**
   * Get deal status by deal ID
   * @param {number} dealId - ID of the deal
   * @returns {Promise<Object>} Deal status object
   */
  getDealStatusByDealId: async (dealId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/deal-status/deal/${dealId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null; // No status found for this deal
        }
        const errorMessage = await parseErrorResponse(response);
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching deal status:', error);
      throw error;
    }
  },

  /**
   * Delete a deal status
   * @param {number} statusId - ID of the deal status to delete
   * @returns {Promise<Object>} Deletion confirmation
   */
  deleteDealStatus: async (statusId) => {
    try {
      const response = await makeAuthenticatedRequest(`${API_BASE_URL}/api/v1/deal-status/${statusId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response);
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
      console.error('Error deleting deal status:', error);
      throw error;
    }
  }
};