import { makeAuthenticatedRequest, parseErrorResponse } from '../../../core/api/client';

export const accountsApi = {
  getAllAccounts: async () => {
    try {
      const response = await makeAuthenticatedRequest('/api/v1/accounts/');
      if (!response.ok) throw new Error(await parseErrorResponse(response));
      return await response.json();
    } catch (error) {
      console.error('Error fetching accounts:', error);
      throw error;
    }
  },

  createAccount: async (accountData) => {
    try {
      const response = await makeAuthenticatedRequest('/api/v1/accounts/', {
        method: 'POST',
        body: JSON.stringify(accountData),
      });
      if (!response.ok) throw new Error(await parseErrorResponse(response));
      return await response.json();
    } catch (error) {
      console.error('Error creating account:', error);
      throw error;
    }
  },

  updateAccount: async (accountId, accountData) => {
    try {
      const response = await makeAuthenticatedRequest(`/api/v1/accounts/${accountId}`, {
        method: 'PUT',
        body: JSON.stringify(accountData),
      });
      if (!response.ok) throw new Error(await parseErrorResponse(response));
      return await response.json();
    } catch (error) {
      console.error('Error updating account:', error);
      throw error;
    }
  },

  deleteAccount: async (accountId) => {
    try {
      const response = await makeAuthenticatedRequest(`/api/v1/accounts/${accountId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error(await parseErrorResponse(response));
      return await response.json();
    } catch (error) {
      console.error('Error deleting account:', error);
      throw error;
    }
  },

  getUsersForKAMSelection: async () => {
    try {
      const response = await makeAuthenticatedRequest('/api/v1/accounts/helpers/users');
      if (!response.ok) throw new Error(await parseErrorResponse(response));
      return await response.json();
    } catch (error) {
      console.error('Error fetching users for KAM selection:', error);
      throw error;
    }
  },

  toggleBlacklist: async (accountId, blacklistData = {}) => {
    try {
      const response = await makeAuthenticatedRequest(`/api/v1/accounts/${accountId}/blacklist/toggle`, {
        method: 'POST',
        body: JSON.stringify(blacklistData),
      });
      if (!response.ok) throw new Error(await parseErrorResponse(response));
      return await response.json();
    } catch (error) {
      console.error('Error toggling account blacklist:', error);
      throw error;
    }
  },

  getBlacklistStatus: async (accountId) => {
    try {
      const response = await makeAuthenticatedRequest(`/api/v1/accounts/${accountId}/blacklist`);
      if (!response.ok) throw new Error(await parseErrorResponse(response));
      return await response.json();
    } catch (error) {
      console.error('Error fetching account blacklist status:', error);
      throw error;
    }
  },
};
