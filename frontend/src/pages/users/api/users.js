const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

/**
 * Parse error response from the API
 * @param {Response} response - The fetch response object
 * @returns {Promise<string>} Error message
 */
const parseErrorResponse = async (response) => {
  try {
    const errorData = await response.json();
    
    // Handle different error response formats
    if (errorData.detail) {
      // FastAPI HTTPException format
      return errorData.detail;
    } else if (errorData.message) {
      // Custom error format
      return errorData.message;
    } else if (errorData.error) {
      // Alternative error format
      return errorData.error;
    } else if (typeof errorData === 'string') {
      return errorData;
    } else {
      // If error data exists but doesn't match expected formats
      return JSON.stringify(errorData);
    }
  } catch (parseError) {
    // If we can't parse the error response, return a generic message with status
    switch (response.status) {
      case 400:
        return 'Bad request - please check your input data';
      case 401:
        return 'Unauthorized - please check your credentials';
      case 403:
        return 'Forbidden - you do not have permission to perform this action';
      case 404:
        return 'Not found - the requested resource does not exist';
      case 409:
        return 'Conflict - this resource already exists';
      case 422:
        return 'Validation error - please check your input data';
      case 500:
        return 'Internal server error - please try again later';
      default:
        return `HTTP error! status: ${response.status}`;
    }
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

export const usersApi = {
  /**
   * Fetch all users from the backend API
   * @returns {Promise<Array>} Array of user objects
   */
  getAllUsers: async () => {
    try {
      const response = await makeAuthenticatedRequest(`${API_BASE_URL}/api/v1/users/`);
      
      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response);
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching users:', error);
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
   * Create a new user
   * @param {Object} userData - User data to create
   * @returns {Promise<Object>} Created user object
   */
  createUser: async (userData) => {
    try {
      const response = await makeAuthenticatedRequest(`${API_BASE_URL}/api/v1/users/`, {
        method: 'POST',
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response);
        throw new Error(errorMessage);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  },

  /**
   * Update an existing user
   * @param {string} ecode - Employee code of the user to update
   * @param {Object} userData - Updated user data
   * @returns {Promise<Object>} Updated user object
   */
  updateUser: async (ecode, userData) => {
    try {
      const response = await makeAuthenticatedRequest(`${API_BASE_URL}/api/v1/users/${ecode}`, {
        method: 'PUT',
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response);
        throw new Error(errorMessage);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  },

}; 
