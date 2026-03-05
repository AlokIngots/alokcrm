// Permissions API - Handles fetching user permissions and roles from backend
import { tokenManager } from '../pages/login/api/auth';

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
 * Permissions API functions
 */
export const permissionsApi = {
  /**
   * Get current user's permissions based on their role
   * @returns {Promise<Object>} User permissions object
   */
  async getUserPermissions() {
    const token = tokenManager.getToken();
    if (!token) {
      throw new Error('No authentication token found');
    }

    console.log('Fetching user permissions from:', `${API_BASE_URL}/api/v1/auth/permissions`);

    const response = await fetch(`${API_BASE_URL}/api/v1/auth/permissions`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorMessage = await parseErrorResponse(response);
      throw new Error(`Failed to fetch permissions: ${errorMessage}`);
    }

    const data = await response.json();
    return data;
  },

  /**
   * Get all available roles from the system
   * @returns {Promise<Array>} Array of role names
   */
  async getAllRoles() {
    const token = tokenManager.getToken();
    if (!token) {
      throw new Error('No authentication token found');
    }

    console.log('Fetching all roles from:', `${API_BASE_URL}/api/v1/auth/roles`);

    const response = await fetch(`${API_BASE_URL}/api/v1/auth/roles`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorMessage = await parseErrorResponse(response);
      throw new Error(`Failed to fetch roles: ${errorMessage}`);
    }

    const data = await response.json();
    return data;
  }
}; 