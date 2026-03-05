import { activityLogApi } from '../../sales-pipeline/api/activity-log';

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

export const inboxApi = {
  /**
   * Get all pending approvals for the current user
   * @returns {Promise<Array>} Array of deals pending approval
   */
  getPendingApprovals: async () => {
    try {
      const response = await makeAuthenticatedRequest(`${API_BASE_URL}/api/v1/inbox/`);
      
      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response);
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('Error fetching pending approvals:', error);
      throw error;
    }
  },

  /**
   * Approve a deal with activity logging
   * @param {number} dealId - ID of the deal to approve
   * @param {string} dealName - Deal name for logging (no longer used)
   * @returns {Promise<Object>} Approval confirmation
   */
  approveDeal: async (dealId, dealName = '') => {
    try {
      const response = await makeAuthenticatedRequest(`${API_BASE_URL}/api/v1/inbox/approve-deal/${dealId}`, {
        method: 'PATCH',
      });

      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response);
        throw new Error(errorMessage);
      }

      const result = await response.json();

      // Log approval activity
      try {
        await activityLogApi.createActivityLog(
          dealId, 
          `approved deal`
        );
      } catch (logError) {
        console.error('Error logging deal approval:', logError);
        // Don't fail the approval if logging fails
      }

      return result;
    } catch (error) {
      console.error('Error approving deal:', error);
      throw error;
    }
  },

  /**
   * Reject a deal with activity logging
   * @param {number} dealId - ID of the deal to reject
   * @param {string} dealName - Deal name for logging (no longer used)
   * @returns {Promise<Object>} Rejection confirmation
   */
  rejectDeal: async (dealId, dealName = '') => {
    try {
      const response = await makeAuthenticatedRequest(`${API_BASE_URL}/api/v1/inbox/reject-deal/${dealId}`, {
        method: 'PATCH',
      });

      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response);
        throw new Error(errorMessage);
      }

      const result = await response.json();

      // Log rejection activity
      try {
        await activityLogApi.createActivityLog(
          dealId, 
          `rejected deal`
        );
      } catch (logError) {
        console.error('Error logging deal rejection:', logError);
        // Don't fail the rejection if logging fails
      }

      return result;
    } catch (error) {
      console.error('Error rejecting deal:', error);
      throw error;
    }
  },

  /**
   * Get approval statistics for the current user
   * @returns {Promise<Object>} Statistics object
   */
  getApprovalStats: async () => {
    try {
      const response = await makeAuthenticatedRequest(`${API_BASE_URL}/api/v1/inbox/stats`);
      
      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response);
        throw new Error(errorMessage);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching approval stats:', error);
      throw error;
    }
  }
};