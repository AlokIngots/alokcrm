
export const blacklistReasons = [
    {
        id: 'legal_action_initiated',
        label: 'Legal Action Initiated',
        value: 'Legal Action Initiated'
    },
    {
        id: 'consistent_payment_irregularities',
        label: 'Consistent Payment Irregularities',
        value: 'Consistent Payment Irregularities'
    },
    {
        id: 'unjustified_deductions',
        label: 'Unjustified Deductions or Claims',
        value: 'Unjustified Deductions or Claims'
    },
    {
        id: 'internal_decision',
        label: 'Internal Decision - Management Directive',
        value: 'Internal Decision - Management Directive'
    },
    {
      id: 'reported_by_peer',
      label: 'Reported By Peer/Association',
      value: 'Reported By Peer/Association'
    },
    {
        id: 'other',
        label: 'Other',
        value: 'Other'
      },
 
];

/**
 * Get all blacklist reason options
 * @returns {Array} Array of blacklist reason objects
 */
export const getBlacklistReasonOptions = () => {
  return blacklistReasons;
};

/**
 * Get blacklist reason by value
 * @param {string} value - The reason value to search for
 * @returns {Object|null} The reason object or null if not found
 */
export const getBlacklistReasonByValue = (value) => {
  return blacklistReasons.find(reason => reason.value === value) || null;
};

/**
 * Check if a reason value is valid
 * @param {string} value - The reason value to validate
 * @returns {boolean} True if valid, false otherwise
 */
export const isValidBlacklistReason = (value) => {
  return blacklistReasons.some(reason => reason.value === value);
}; 