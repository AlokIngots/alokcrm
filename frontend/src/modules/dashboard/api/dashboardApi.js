import { makeAuthenticatedRequest, parseErrorResponse } from '../../../core/api/client';

export const dashboardApi = {
  getFinancialYears: async () => {
    try {
      const response = await makeAuthenticatedRequest('/api/v1/targets/financial-years');
      if (!response.ok) throw new Error(await parseErrorResponse(response));

      const data = await response.json();
      if (Array.isArray(data)) return data;
      if (Array.isArray(data?.financial_years)) return data.financial_years;
      if (Array.isArray(data?.years)) return data.years;
      if (Array.isArray(data?.data)) return data.data;
      return [];
    } catch (error) {
      console.error('Error fetching financial years:', error);
      throw error;
    }
  },

  getDashboardSummary: async (filters = {}) => {
    try {
      const queryParams = new URLSearchParams();
      if (filters.fy) queryParams.append('fy', filters.fy);
      if (filters.division) queryParams.append('division', filters.division);
      if (filters.zone) queryParams.append('zone', filters.zone);
      if (filters.cluster) queryParams.append('cluster', filters.cluster);
      if (filters.salesperson) queryParams.append('salesperson', filters.salesperson);

      const suffix = queryParams.toString() ? `?${queryParams.toString()}` : '';
      const response = await makeAuthenticatedRequest(`/api/v1/dashboard/${suffix}`);
      if (!response.ok) throw new Error(await parseErrorResponse(response));

      return await response.json();
    } catch (error) {
      console.error('Error fetching dashboard summary:', error);
      throw error;
    }
  },

  getFilterOptions: async (filters = {}) => {
    try {
      const queryParams = new URLSearchParams();
      if (filters.division) queryParams.append('division', filters.division);
      if (filters.zone) queryParams.append('zone', filters.zone);
      if (filters.cluster) queryParams.append('cluster', filters.cluster);

      const suffix = queryParams.toString() ? `?${queryParams.toString()}` : '';
      const response = await makeAuthenticatedRequest(`/api/v1/users/filter-options${suffix}`);
      if (!response.ok) throw new Error(await parseErrorResponse(response));

      return await response.json();
    } catch (error) {
      console.error('Error fetching filter options:', error);
      throw error;
    }
  },
};
