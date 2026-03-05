const API_BASE_URL = process.env.REACT_APP_API_BASE_URL
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
 * User management utilities
 */
export const userManager = {
  /**
   * Store user data in localStorage
   * @param {Object} userData - User data object
   */
  setUser: (userData) => {
    localStorage.setItem('current_user', JSON.stringify(userData));
  },

  /**
   * Get user data from localStorage
   * @returns {Object|null} User data object or null if not found
   */
  getUser: () => {
    const userData = localStorage.getItem('current_user');
    return userData ? JSON.parse(userData) : null;
  },

  /**
   * Remove user data from localStorage
   */
  removeUser: () => {
    localStorage.removeItem('current_user');
  },

  /**
   * Check if user data exists
   * @returns {boolean} True if user data exists
   */
  hasUser: () => {
    return !!localStorage.getItem('current_user');
  }
};

/**
 * Token management utilities
 */
export const tokenManager = {
  /**
   * Store access token in localStorage
   * @param {string} token - JWT access token
   */
  setToken: (token) => {
    localStorage.setItem('access_token', token);
  },

  /**
   * Get access token from localStorage
   * @returns {string|null} JWT access token or null if not found
   */
  getToken: () => {
    return localStorage.getItem('access_token');
  },

  /**
   * Remove access token from localStorage
   */
  removeToken: () => {
    localStorage.removeItem('access_token');
    // Also remove user data when removing token
    userManager.removeUser();
  },

  /**
   * Check if user is authenticated (has valid token)
   * @returns {boolean} True if user has token
   */
  isAuthenticated: () => {
    return !!localStorage.getItem('access_token');
  }
};

/**
 * Authentication API
 */
export const authApi = {
  /**
   * Send OTP to user's phone number
   * @param {string} ecode - Employee code
   * @returns {Promise<Object>} Response with session ID and message
   */
  sendOTP: async (ecode) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ECode: ecode }),
      });

      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response);
        throw new Error(errorMessage);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error sending OTP:', error);
      throw error;
    }
  },

  /**
   * Verify OTP and get access token
   * @param {string} sessionId - Session ID from sendOTP response
   * @param {string} otp - OTP entered by user
   * @returns {Promise<Object>} Response with access token and user data
   */
  verifyOTP: async (sessionId, otp) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          session_id: sessionId, 
          otp: otp 
        }),
      });

      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response);
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      // Store token and user data for future requests
      if (data.access_token) {
        tokenManager.setToken(data.access_token);
      }
      
      if (data.user) {
        userManager.setUser(data.user);
      }
      
      return data;
    } catch (error) {
      console.error('Error verifying OTP:', error);
      throw error;
    }
  },

  /**
   * Get current user details using stored token
   * @returns {Promise<Object>} Current user data
   */
  getCurrentUser: async () => {
    try {
      const token = tokenManager.getToken();
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
      });

      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response);
        // If token is invalid, remove it
        if (response.status === 401) {
          tokenManager.removeToken();
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error getting current user:', error);
      throw error;
    }
  },

  /**
   * Make authenticated API request
   * @param {string} url - API endpoint URL
   * @param {Object} options - Fetch options
   * @returns {Promise<Response>} Fetch response
   */
  makeAuthenticatedRequest: async (url, options = {}) => {
    const token = tokenManager.getToken();
    
    if (!token) {
      throw new Error('No authentication token found');
    }

    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
  },

  /**
   * Logout user by removing token and user data
   */
  logout: () => {
    tokenManager.removeToken();
    userManager.removeUser();
  }
}; 