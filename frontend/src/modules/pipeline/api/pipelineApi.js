import { activityLogApi } from '../../../pages/sales-pipeline/api/activity-log';
import { makeAuthenticatedRequest, parseErrorResponse } from '../../../core/api/client';

export const pipelineApi = {
  getAllDeals: async () => {
    try {
      const response = await makeAuthenticatedRequest('/api/v1/deals/');

      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response);
        throw new Error(errorMessage);
      }

      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('Error fetching deals:', error);
      throw error;
    }
  },

  updateDealStage: async (dealId, newStage) => {
    try {
      const response = await makeAuthenticatedRequest(`/api/v1/deals/${dealId}/stage`, {
        method: 'PATCH',
        body: JSON.stringify({ Stage: newStage }),
      });

      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response);
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
      console.error('Error updating deal stage:', error);
      throw error;
    }
  },

  createDeal: async (dealData) => {
    try {
      const response = await makeAuthenticatedRequest('/api/v1/deals/', {
        method: 'POST',
        body: JSON.stringify(dealData),
      });

      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response);
        throw new Error(errorMessage);
      }

      const createdDeal = await response.json();

      try {
        await activityLogApi.createActivityLog(createdDeal.ID, 'created deal');
      } catch (logError) {
        console.error('Error logging deal creation:', logError);
      }

      return createdDeal;
    } catch (error) {
      console.error('Error creating deal:', error);
      throw error;
    }
  },

  downloadOfferLetter: async (dealId) => {
    try {
      const response = await makeAuthenticatedRequest(`/api/v1/deals/${dealId}/offer-letter`);

      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response);
        throw new Error(errorMessage);
      }

      const blob = await response.blob();
      const disposition = response.headers.get('content-disposition') || '';
      const match = disposition.match(/filename="?([^"]+)"?/i);
      const filename = match?.[1] || `offer-letter-${dealId}.pdf`;

      return { blob, filename };
    } catch (error) {
      console.error('Error downloading offer letter:', error);
      throw error;
    }
  },

  toggleDealDisplay: async (dealId, displayDeal) => {
    try {
      const response = await makeAuthenticatedRequest(`/api/v1/deals/${dealId}/toggle-display`, {
        method: 'PATCH',
        body: JSON.stringify({ DisplayDeal: displayDeal }),
      });

      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response);
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
      console.error('Error toggling deal display:', error);
      throw error;
    }
  },

  updateDeal: async (dealId, updateData, _dealName = '', originalDeal = null) => {
    try {
      const response = await makeAuthenticatedRequest(`/api/v1/deals/${dealId}`, {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response);
        throw new Error(errorMessage);
      }

      const updatedDeal = await response.json();

      try {
        const changes = [];

        if (updateData.DealValue !== undefined && originalDeal) {
          const oldValue = parseFloat(originalDeal.DealValue);
          const newValue = parseFloat(updateData.DealValue);
          if (oldValue !== newValue) {
            const { formatIndianCurrency } = await import('../../../pages/sales-pipeline/utils/formatters');
            changes.push(`updated deal value from ${formatIndianCurrency(oldValue)} to ${formatIndianCurrency(newValue)}`);
          }
        }

        if (updateData.ExpectedClosureDate !== undefined && originalDeal) {
          const formatDateForComparison = (dateString) => {
            if (!dateString) return '';
            const date = new Date(dateString);
            return date.toISOString().split('T')[0];
          };

          const oldDate = formatDateForComparison(originalDeal.ExpectedClosureDate);
          const newDate = formatDateForComparison(updateData.ExpectedClosureDate);

          if (oldDate !== newDate) {
            const formattedDate = new Date(updateData.ExpectedClosureDate).toLocaleDateString('en-IN');
            const formattedOldDate = new Date(originalDeal.ExpectedClosureDate).toLocaleDateString('en-IN');
            changes.push(`updated expected closure date from ${formattedOldDate} to ${formattedDate}`);
          }
        }

        if (changes.length > 0) {
          await activityLogApi.createActivityLog(dealId, changes.join(' and '));
        }
      } catch (logError) {
        console.error('Error logging deal update:', logError);
      }

      return updatedDeal;
    } catch (error) {
      console.error('Error updating deal:', error);
      throw error;
    }
  },

  updateDealTemperature: async (dealId, temperature) => {
    try {
      const response = await makeAuthenticatedRequest(`/api/v1/deals/${dealId}/temperature`, {
        method: 'PATCH',
        body: JSON.stringify({ Temperature: temperature }),
      });

      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response);
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
      console.error('Error updating deal temperature:', error);
      throw error;
    }
  },

  getDealsBySalesperson: async (ecode) => {
    try {
      const response = await makeAuthenticatedRequest(`/api/v1/deals/salesperson/${ecode}`);

      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response);
        throw new Error(errorMessage);
      }

      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('Error fetching deals by salesperson:', error);
      throw error;
    }
  },

  reassignDeals: async (dealIds, newSalespersonEcode) => {
    try {
      const response = await makeAuthenticatedRequest('/api/v1/deals/reassign-salesperson', {
        method: 'PATCH',
        body: JSON.stringify({
          deal_ids: dealIds,
          new_salesperson_ecode: newSalespersonEcode,
        }),
      });

      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response);
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
      console.error('Error reassigning deals:', error);
      throw error;
    }
  },
};
