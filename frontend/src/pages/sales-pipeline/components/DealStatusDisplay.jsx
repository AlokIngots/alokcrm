import React from 'react';
import { getReasonLabel } from '../../../config/deal-status-reasons';

const DealStatusDisplay = ({ dealStatus, onEdit, className = '' }) => {
  if (!dealStatus) return null;

  const reasonLabel = getReasonLabel(dealStatus.Status, dealStatus.Reason);
  const stageTitle = dealStatus.Status === 'DEAL_ON_HOLD' ? 'Deal on Hold' : 'Deal Lost';

  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-gray-900 mb-2">
            {stageTitle} Details
          </h3>
          
          <div className="space-y-2">
            <div>
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Reason:
              </span>
              <p className="text-sm text-gray-900 mt-1">{reasonLabel}</p>
            </div>
            
            {dealStatus.Notes && (
              <div>
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Notes:
                </span>
                <p className="text-sm text-gray-900 mt-1 break-words">{dealStatus.Notes}</p>
              </div>
            )}
            
            {dealStatus.CreatedAt && (
              <div>
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Date:
                </span>
                <p className="text-sm text-gray-900 mt-1">
                  {new Date(dealStatus.CreatedAt).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>
        </div>
        
        {onEdit && (
          <button
            onClick={onEdit}
            className="ml-3 text-gray-400 hover:text-gray-600 transition-colors"
            title="Edit status"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

export default DealStatusDisplay;