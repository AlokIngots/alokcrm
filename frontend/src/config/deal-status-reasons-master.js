export const DEAL_STATUS_REASONS = {
  DEAL_ON_HOLD: [
    { id: 'customer_deferred_decision', label: 'Customer Deferred Decision' },
    { id: 'pending_internal_approvals', label: 'Pending Internal Approvals (Customer)' },
    { id: 'trial_in_progress', label: 'Trial/POC in Progress' },
    { id: 'pending_documentation', label: 'Pending Documentation or Compliance' },
    { id: 'internal_constraints', label: 'Internal Capacity/Resource Constraints' },
    { id: 'customer_unresponsive', label: 'Customer Unresponsive / Follow-up Scheduled' },
    { id: 'other', label: 'Others' }
  ],
  DEAL_LOST: [
    { id: 'lost_price', label: 'Lost to Competition – Price' },
    { id: 'lost_service', label: 'Lost to Competition – Service Capability' },
    { id: 'chose_existing_vendor', label: 'Customer Chose Existing Vendor' },
    { id: 'cancelled_requirement', label: 'Customer Cancelled Requirement' },
    { id: 'scope_mismatch', label: 'Scope or Capability Mismatch' },
    { id: 'delayed_response', label: 'Delayed Proposal/Response from Our End' },
    { id: 'customer_unreachable', label: 'Customer Unreachable/No Response' },
    { id: 'credit_terms_unacceptable', label: 'Credit Terms Not Acceptable' },
    { id: 'penalty_terms_unacceptable', label: 'Penalty Terms Not Acceptable' },
    { id: 'other', label: 'Others' }
  ]
};

  
export const getReasonsByStage = (stage) => {
  return DEAL_STATUS_REASONS[stage] || [];
};

export const getReasonLabel = (stage, reasonId) => {
  const reasons = getReasonsByStage(stage);
  const reason = reasons.find(r => r.id === reasonId);
  return reason ? reason.label : reasonId;
};