import { makeAuthenticatedRequest, parseErrorResponse } from '../../../core/api/client';

export const enquiriesApi = {
  getAllEnquiries: async () => {
    const response = await makeAuthenticatedRequest('/api/v1/enquiries/');
    if (!response.ok) throw new Error(await parseErrorResponse(response));
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  },

  getGradeMasters: async (limit = 1000) => {
    const response = await makeAuthenticatedRequest(`/api/v1/enquiries/masters/grades?limit=${limit}`);
    if (!response.ok) throw new Error(await parseErrorResponse(response));
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  },

  getToleranceMasters: async () => {
    const response = await makeAuthenticatedRequest('/api/v1/enquiries/masters/tolerances');
    if (!response.ok) throw new Error(await parseErrorResponse(response));
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  },
};
