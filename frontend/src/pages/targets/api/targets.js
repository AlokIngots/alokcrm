const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

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
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
  });
};

/**
 * Make authenticated JSON request with JWT token
 * @param {string} url - The API endpoint URL
 * @param {Object} options - Fetch options
 * @returns {Promise<Response>} Fetch response
 */
const makeAuthenticatedJSONRequest = async (url, options = {}) => {
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

export const targetsApi = {
  /**
   * Get subordinates of the current user
   * @returns {Promise<Object>} Response with subordinates array
   */
  getSubordinates: async () => {
    try {
      const response = await makeAuthenticatedRequest(`${API_BASE_URL}/api/v1/users/subordinates`);

      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorData.message || errorData.error || errorMessage;
        } catch (parseError) {
          // If we can't parse the error response, use the status
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching subordinates:', error);
      throw error;
    }
  },

  /**
   * Get financial years for a specific user
   * @param {string} ecode - Employee code
   * @returns {Promise<Array>} Array of financial years
   */
  getFinancialYears: async (ecode) => {
    try {
      const response = await makeAuthenticatedRequest(`${API_BASE_URL}/api/v1/targets/financial-years?ecode=${encodeURIComponent(ecode)}`);

      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorData.message || errorData.error || errorMessage;
        } catch (parseError) {
          // If we can't parse the error response, use the status
        }
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
   * Get user targets for a specific user and financial year
   * @param {string} ecode - Employee code
   * @param {string} fy - Financial year
   * @returns {Promise<Array>} Array of target data
   */
  getUserTargets: async (ecode, fy) => {
    try {
      const response = await makeAuthenticatedRequest(`${API_BASE_URL}/api/v1/targets/user-targets?ecode=${encodeURIComponent(ecode)}&fy=${encodeURIComponent(fy)}`);

      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorData.message || errorData.error || errorMessage;
        } catch (parseError) {
          // If we can't parse the error response, use the status
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching user targets:', error);
      throw error;
    }
  },

  /**
   * Download targets template with specified accounts and salesperson
   * @param {Object} requestData - Request data
   * @param {Array<number>} requestData.account_ids - Array of account IDs
   * @param {string} requestData.ecode - Employee code of the salesperson
   * @returns {Promise<Blob>} Excel file blob
   */
  downloadTemplate: async (requestData) => {
    try {
      const response = await makeAuthenticatedJSONRequest(`${API_BASE_URL}/api/v1/targets/download-template`, {
        method: 'POST',
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorData.message || errorData.error || errorMessage;
        } catch (parseError) {
          // If we can't parse the error response, use the status
        }
        throw new Error(errorMessage);
      }

      // Return the blob for file download
      const blob = await response.blob();
      return blob;
    } catch (error) {
      console.error('Error downloading template:', error);
      throw error;
    }
  },

  /**
   * Upload targets template file
   * @param {File} file - Excel file to upload
   * @param {string} ecode - Employee code of the salesperson
   * @returns {Promise<Object>} Upload response with success/error details
   */
  uploadTemplate: async (file, ecode) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('ecode', ecode);

      const response = await makeAuthenticatedRequest(`${API_BASE_URL}/api/v1/targets/upload-template`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorData.message || errorData.error || errorMessage;
        } catch (parseError) {
          // If we can't parse the error response, use the status
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error uploading template:', error);
      throw error;
    }
  }
}; 