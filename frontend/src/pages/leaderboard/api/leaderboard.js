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

export const leaderboardApi = {
  /**
   * Fetch leaderboard data from the backend API
   * @param {string} division - Division filter (Local or Export)
   * @param {string} fy - Financial year (e.g., '2025-2026')
   * @returns {Promise<Array>} Leaderboard data array
   */
  getLeaderboard: async (division, fy) => {
    try {
      const queryParams = new URLSearchParams();
      
      if (division) {
        queryParams.append('division', division);
      }
      
      if (fy) {
        queryParams.append('fy', fy);
      }

      const url = `${API_BASE_URL}/api/v1/leaderboard${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      const response = await makeAuthenticatedRequest(url);
      
      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response);
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      throw error;
    }
  }
};
