import { makeAuthenticatedRequest, parseErrorResponse } from '../../../core/api/client';

export const contactsApi = {
  getAllContacts: async () => {
    try {
      const response = await makeAuthenticatedRequest('/api/v1/contacts/');
      if (!response.ok) throw new Error(await parseErrorResponse(response));
      return await response.json();
    } catch (error) {
      console.error('Error fetching contacts:', error);
      throw new Error('Failed to fetch contacts');
    }
  },

  getContactsByAccount: async (accountName) => {
    try {
      const response = await makeAuthenticatedRequest(`/api/v1/contacts/search/by-account-name/${encodeURIComponent(accountName)}`);
      if (!response.ok) throw new Error(await parseErrorResponse(response));
      return await response.json();
    } catch (error) {
      console.error('Error fetching contacts by account:', error);
      throw new Error('Failed to fetch contacts for the selected account');
    }
  },

  getContactsByCompanyId: async (accountId) => {
    try {
      const response = await makeAuthenticatedRequest(`/api/v1/contacts/search/by-account/${accountId}`);
      if (!response.ok) throw new Error(await parseErrorResponse(response));
      return await response.json();
    } catch (error) {
      console.error('Error fetching contacts by account ID:', error);
      throw new Error('Failed to fetch contacts for the selected account');
    }
  },

  getContactsByAccountId: async (accountId) => {
    return contactsApi.getContactsByCompanyId(accountId);
  },

  createContact: async (contactData) => {
    try {
      const response = await makeAuthenticatedRequest('/api/v1/contacts/', {
        method: 'POST',
        body: JSON.stringify(contactData),
      });
      if (!response.ok) throw new Error(await parseErrorResponse(response));
      return await response.json();
    } catch (error) {
      console.error('Error creating contact:', error);
      throw new Error(error.message || 'Failed to create contact');
    }
  },

  updateContact: async (contactId, contactData) => {
    try {
      const response = await makeAuthenticatedRequest(`/api/v1/contacts/${contactId}`, {
        method: 'PUT',
        body: JSON.stringify(contactData),
      });
      if (!response.ok) throw new Error(await parseErrorResponse(response));
      return await response.json();
    } catch (error) {
      console.error('Error updating contact:', error);
      throw new Error(error.message || 'Failed to update contact');
    }
  },

  patchContact: async (contactId, contactData) => {
    try {
      const response = await makeAuthenticatedRequest(`/api/v1/contacts/${contactId}`, {
        method: 'PATCH',
        body: JSON.stringify(contactData),
      });
      if (!response.ok) throw new Error(await parseErrorResponse(response));
      return await response.json();
    } catch (error) {
      console.error('Error updating contact:', error);
      throw new Error(error.message || 'Failed to update contact');
    }
  },

  deleteContact: async (contactId) => {
    try {
      const response = await makeAuthenticatedRequest(`/api/v1/contacts/${contactId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error(await parseErrorResponse(response));
      return true;
    } catch (error) {
      console.error('Error deleting contact:', error);
      throw new Error(error.message || 'Failed to delete contact');
    }
  },
};
