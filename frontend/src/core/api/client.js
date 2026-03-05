const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

export const parseErrorResponse = async (response) => {
  try {
    const errorData = await response.json();

    if (errorData.detail) {
      if (typeof errorData.detail === 'string') return errorData.detail;
      if (Array.isArray(errorData.detail)) {
        return errorData.detail.map((err) => err.msg || err.message || JSON.stringify(err)).join(', ');
      }
      return JSON.stringify(errorData.detail);
    }

    return errorData.message || `HTTP error! status: ${response.status}`;
  } catch {
    return `HTTP error! status: ${response.status}`;
  }
};

export const makeAuthenticatedRequest = async (path, options = {}) => {
  const token = localStorage.getItem('access_token');

  if (!token) {
    throw new Error('No authentication token found');
  }

  return fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
};
