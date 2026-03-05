export const PIPELINE_STAGES = {
    NEW: {
      id: 'NEW',
      title: 'Enquiry',
      color: 'bg-gray-50',
      headerColor: 'bg-gray-100'
    },
    FEASIBILITY: {
      id: 'FEASIBILITY',
      title: 'Feasibility',
      color: 'bg-amber-50',
      headerColor: 'bg-amber-100'
    },
    OFFER_SUBMITTED: {
      id: 'OFFER_SUBMITTED',
      title: 'Offer',
      color: 'bg-blue-50',
      headerColor: 'bg-blue-100'
    },
    DEAL_LOST: {
      id: 'DEAL_LOST',
      title: 'Order Lost',
      color: 'bg-red-50',
      headerColor: 'bg-red-100'
    },
    DEAL_WON: {
      id: 'DEAL_WON',
      title: 'Order Won',
      color: 'bg-green-50',
      headerColor: 'bg-green-100'
    },
  };

export const getPipelineStageOptions = () => {
  return Object.values(PIPELINE_STAGES);
};

export const getStageById = (stageId) => {
  return PIPELINE_STAGES[stageId] || null;
};
