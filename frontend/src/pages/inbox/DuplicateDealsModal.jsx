import React, { useState } from 'react';
import { formatIndianCurrency } from '../accounts/utils/accountUtils';
import { getDivisionConfig, getDivisionLabel } from '../../config/divisions';

const DuplicateDealsModal = ({ isOpen, onClose, duplicateData, onApprove, onReject }) => {
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  if (!isOpen || !duplicateData) return null;

  const { existing_deal, new_deal, duplicate_info } = duplicateData;
  const divisionConfig = getDivisionConfig(duplicate_info?.division);

  const handleApprove = async () => {
    if (isApproving || isRejecting || !new_deal?.ID) return;
    
    setIsApproving(true);
    try {
      await onApprove(new_deal.ID);
      onClose();
    } catch (error) {
      console.error('Error approving duplicate deal:', error);
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    if (isApproving || isRejecting || !new_deal?.ID) return;
    
    setIsRejecting(true);
    try {
      await onReject(new_deal.ID);
      onClose();
    } catch (error) {
      console.error('Error rejecting duplicate deal:', error);
    } finally {
      setIsRejecting(false);
    }
  };

  const formatDate = (dateString) => {
    return dateString ? new Date(dateString).toLocaleDateString() : 'N/A';
  };

  const DealCard = ({ deal, title, highlight = false }) => {
    if (!deal) return null;

    return (
      <div className={`border rounded-lg p-4 h-full ${highlight ? 'border-orange-300 bg-orange-50' : 'border-gray-200 bg-gray-50'}`}>
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className={`text-lg font-semibold ${highlight ? 'text-orange-900' : 'text-gray-900'}`}>
              {title}
            </h3>
            {deal.Flag && (
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                deal.Flag === 'DUPLICATE' ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-800'
              }`}>
                {deal.Flag}
              </span>
            )}
          </div>
          <h3 className={`text-lg font-semibold ${highlight ? 'text-orange-900' : 'text-gray-900'}`}>
              {deal.AccountName}
            </h3>
          <div className="flex items-center justify-between">
            <div>
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${divisionConfig.badgeColor}`}>
              {getDivisionLabel(deal.Division)}
            </span>
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium`}>
              {deal.ServiceType}
            </span>
            </div>
            <div>
              
            </div>
            <span className="text-lg font-semibold text-green-600">
              {formatIndianCurrency(deal.DealValue)}
            </span>
          </div>
        </div>

        <div className="space-y-3">
          {/* Basic Deal Information */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Expected Closure</dt>
              <dd className="mt-1 text-sm text-gray-900">{formatDate(deal.ExpectedClosureDate)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Lead Source</dt>
              <dd className="mt-1 text-sm text-gray-900">{deal.LeadSource || 'N/A'}</dd>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Status</dt>
              <dd className="mt-1">
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  deal.Status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                  deal.Status === 'PENDING' ? 'bg-orange-100 text-orange-800' :
                  deal.Status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {deal.Status}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Stage</dt>
              <dd className="mt-1 text-sm text-gray-900">{deal.Stage?.replace('_', ' ') || 'N/A'}</dd>
            </div>
          </div>

          {/* Sales Team Information */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Salesperson</dt>
              <dd className="mt-1 text-sm text-gray-900 font-medium">{deal.SalespersonName}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Lead Generated By</dt>
              <dd className="mt-1 text-sm text-gray-900">{deal.LeadGeneratorName || 'N/A'}</dd>
            </div>
          </div>

          {/* Contact Information */}
          <div>
            <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Contact Name</dt>
            <dd className="mt-1 text-sm text-gray-900 font-medium">{deal.ContactName}</dd>
          </div>

          {deal.ContactEmail && (
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Contact Email</dt>
              <dd className="mt-1 text-sm text-blue-600">
                <a href={`mailto:${deal.ContactEmail}`} className="hover:underline">
                  {deal.ContactEmail}
                </a>
              </dd>
            </div>
          )}

          {deal.ContactPhone && (
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Contact Phone</dt>
              <dd className="mt-1 text-sm text-blue-600">
                <a href={`tel:${deal.ContactPhone}`} className="hover:underline">
                  {deal.ContactPhone}
                </a>
              </dd>
            </div>
          )}

          {/* Account Information */}
          {deal.AccountIndustry && (
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Account Industry</dt>
              <dd className="mt-1 text-sm text-gray-900">{deal.AccountIndustry}</dd>
            </div>
          )}

          {deal.AccountWebsite && (
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Account Website</dt>
              <dd className="mt-1 text-sm text-blue-600">
                <a 
                  href={deal.AccountWebsite.startsWith('http') ? deal.AccountWebsite : `https://${deal.AccountWebsite}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  {deal.AccountWebsite}
                </a>
              </dd>
            </div>
          )}

          {deal.AccountTurnover && (
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Account Turnover</dt>
              <dd className="mt-1 text-sm text-gray-900">{formatIndianCurrency(deal.AccountTurnover)}</dd>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {deal.AccountDivision && (
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Account Division</dt>
                <dd className="mt-1 text-sm text-gray-900">{deal.AccountDivision}</dd>
              </div>
            )}
            {deal.AccountLocation && (
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Account Location</dt>
                <dd className="mt-1 text-sm text-gray-900">{deal.AccountLocation}</dd>
              </div>
            )}
          </div>

          {/* Notes */}
          {deal.Notes && (
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Notes</dt>
              <dd className="mt-1 text-sm text-gray-900 bg-white p-3 rounded border">
                {deal.Notes}
              </dd>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl max-h-[95vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                <svg className="w-6 h-6 text-orange-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                Duplicate Deal Detected
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Two deals found for the same account, division, and service type. Review and decide whether to approve the new deal.
              </p>
            </div>
            <button
              onClick={onClose}
              disabled={isApproving || isRejecting}
              className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(95vh-140px)]">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <DealCard 
              deal={existing_deal} 
              title="Existing Deal" 
            />
            <DealCard 
              deal={new_deal} 
              title="New Deal (Pending Approval)" 
              highlight={true}
            />
          </div>

          {/* Warning Message */}
          <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex">
              <svg className="w-5 h-5 text-yellow-400 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div>
                <h3 className="text-sm font-medium text-yellow-800">Attention Required</h3>
                <p className="text-sm text-yellow-700 mt-1">
                  The new deal appears to be a duplicate of an existing deal. If you approve this deal, both deals will be active in the system. 
                  Consider coordinating with the salespeople involved to avoid conflicts.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 py-2 px-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            disabled={isApproving || isRejecting}
            className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleReject}
            disabled={isApproving || isRejecting}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {isRejecting ? (
              <>
                <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle>
                  <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75"></path>
                </svg>
                Rejecting...
              </>
            ) : (
              'Reject New Deal'
            )}
          </button>
          <button
            onClick={handleApprove}
            disabled={isApproving || isRejecting}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {isApproving ? (
              <>
                <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle>
                  <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75"></path>
                </svg>
                Approving...
              </>
            ) : (
              'Approve New Deal'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DuplicateDealsModal; 
