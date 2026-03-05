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

export const actualsApi = {
  /**
   * Get all financial years (without ecode filter)
   * @returns {Promise<Array>} Array of financial years
   */
  getFinancialYears: async () => {
    try {
      const response = await makeAuthenticatedRequest(`${API_BASE_URL}/api/v1/targets/financial-years`);

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
   * Download actuals template for specified financial year and month
   * @param {string} fy - Financial year (e.g., '25-26')
   * @param {string} month - Month (Apr-Mar)
   * @returns {Promise<Blob>} Excel file blob
   */
  downloadTemplate: async (fy, month) => {
    try {
      const response = await makeAuthenticatedRequest(
        `${API_BASE_URL}/api/v1/actuals/download-template?fy=${encodeURIComponent(fy)}&month=${encodeURIComponent(month)}`,
        {
          method: 'POST',
        }
      );

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
      console.error('Error downloading actuals template:', error);
      throw error;
    }
  },

  /**
   * Upload actuals template file
   * @param {File} file - Excel file to upload
   * @param {string} fy - Financial year (e.g., '25-26')
   * @param {string} month - Month (Apr-Mar)
   * @returns {Promise<Object>} Upload response with success/error details
   */
  uploadTemplate: async (file, fy, month) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('fy', fy);
      formData.append('month', month);

      const response = await makeAuthenticatedRequest(`${API_BASE_URL}/api/v1/actuals/upload-template`, {
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
      console.error('Error uploading actuals template:', error);
      throw error;
    }
  }
}; 