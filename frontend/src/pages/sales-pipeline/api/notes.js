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
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
  });
};

export const notesApi = {
  // Get note for a deal
  getNote: async (dealId) => {
    try {
      const response = await makeAuthenticatedRequest(`${API_BASE_URL}/api/v1/deals/${dealId}/notes`, {
        method: 'GET',
      });

      if (response.status === 404) {
        // Note not found - return null instead of throwing error
        return null;
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch note: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching note:', error);
      throw error;
    }
  },

  // Create a new note
  createNote: async (dealId, notes) => {
    try {
      const response = await makeAuthenticatedRequest(`${API_BASE_URL}/api/v1/deals/${dealId}/notes`, {
        method: 'POST',
        body: JSON.stringify({ Notes: notes }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create note: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error creating note:', error);
      throw error;
    }
  },

  // Update an existing note
  updateNote: async (dealId, notes) => {
    try {
      const response = await makeAuthenticatedRequest(`${API_BASE_URL}/api/v1/deals/${dealId}/notes`, {
        method: 'PUT',
        body: JSON.stringify({ Notes: notes }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update note: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error updating note:', error);
      throw error;
    }
  },
}; 