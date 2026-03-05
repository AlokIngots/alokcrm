import React, { useEffect, useState } from 'react';
import { PIPELINE_STAGES } from '../../config/pipeline-stages';

const MoveConfirmationModal = ({ isOpen, onConfirm, onCancel, deal, newStage, oldStage }) => {
  const [feasibilityChecked, setFeasibilityChecked] = useState(false);
  const [feasibilityReason, setFeasibilityReason] = useState('');
  const oldStageTitle = PIPELINE_STAGES[oldStage]?.title || oldStage;
  const newStageTitle = PIPELINE_STAGES[newStage]?.title || newStage;
  const needsFeasibilityConfirmation = oldStage === 'NEW' && newStage === 'OFFER_SUBMITTED';

  useEffect(() => {
    if (isOpen) {
      setFeasibilityChecked(false);
      setFeasibilityReason('');
    }
  }, [isOpen, oldStage, newStage, deal?.ID]);

  const canConfirm = needsFeasibilityConfirmation
    ? feasibilityChecked && feasibilityReason.trim().length > 2
    : true;

  if (!isOpen || !deal) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="p-6">
          <div className="flex items-center mb-4">
            <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-blue-100">
              <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </div>
          </div>
          
          <div className="text-center">
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Confirm Deal Move
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Are you sure you want to move this deal?
            </p>
            
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <div className="text-sm font-medium text-gray-900 mb-1">
                {deal.AccountName}
              </div>
              <div className="text-xs text-gray-600 mb-3">
                {deal.ServiceType}
              </div>
              
              <div className="flex items-center justify-center space-x-2 text-sm">
                <span className="px-2 py-1 bg-red-100 text-red-800 rounded">
                  {oldStageTitle}
                </span>
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span className="px-2 py-1 bg-green-100 text-green-800 rounded">
                  {newStageTitle}
                </span>
              </div>
            </div>

            {needsFeasibilityConfirmation && (
              <div className="text-left bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4 space-y-3">
                <p className="text-sm font-medium text-amber-900">
                  Direct move from Enquiries to Offer requires feasibility confirmation.
                </p>
                <label className="flex items-start gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={feasibilityChecked}
                    onChange={(e) => setFeasibilityChecked(e.target.checked)}
                    className="mt-1"
                  />
                  <span>Feasibility is already known/validated for this enquiry.</span>
                </label>
                <textarea
                  value={feasibilityReason}
                  onChange={(e) => setFeasibilityReason(e.target.value)}
                  placeholder="Reason for skipping Feasibility stage (required)"
                  className="w-full p-2 border border-amber-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  rows={3}
                />
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm({
              feasibilityConfirmed: feasibilityChecked,
              feasibilityReason: feasibilityReason.trim()
            })}
            disabled={!canConfirm}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Confirm Move
          </button>
        </div>
      </div>
    </div>
  );
};

export default MoveConfirmationModal;
