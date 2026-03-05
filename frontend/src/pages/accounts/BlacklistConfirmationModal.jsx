import React, { useState } from 'react';
import { getBlacklistReasonOptions } from '../../config/blacklist-reason-master';
import { NoSymbolIcon, ArrowUturnLeftIcon } from '@heroicons/react/24/outline';

const BlacklistConfirmationModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  account, 
  isBlacklisting 
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const reasonOptions = getBlacklistReasonOptions();

  const handleConfirm = async () => {
    setError('');
    
   // Validate required fields
    if (isBlacklisting) {
      if (!reason) {
        setError('Please select a reason for blacklisting this account.');
        return;
      }
    } else {
      if (!notes.trim()) {
        setError('Please enter notes for removing this account from the blacklist.');
        return;
      }
    }

    setIsLoading(true);
    try {
      const blacklistData = {
        reason: isBlacklisting ? reason : '',
        notes: notes.trim() || ''
      };
      
      await onConfirm(blacklistData);
      onClose();
    } catch (error) {
      console.error('Error toggling blacklist:', error);
      // Error handling is done in parent component
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setReason('');
    setNotes('');
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex items-center mb-4">
          <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
            isBlacklisting ? 'bg-red-100' : 'bg-green-100'
          }`}>
            {isBlacklisting ? (
              <NoSymbolIcon className="w-6 h-6 text-red-600" />
            ) : (
              <ArrowUturnLeftIcon className="w-6 h-6 text-green-600" />
            )}
          </div>
          <div className="ml-3">
            <h3 className="text-lg font-medium text-gray-900">
              {isBlacklisting ? 'Blacklist Account' : 'Remove from Blacklist'}
            </h3>
          </div>
        </div>

        <div className="mb-6">
          <p className="text-sm text-gray-600 mb-2">
            {isBlacklisting 
              ? 'Are you sure you want to blacklist this account? This action will prevent new deals from being created with this account.'
              : 'Are you sure you want to remove this account from the blacklist? This will allow new deals to be created with this account again.'
            }
          </p>
          
          <div className="bg-gray-50 rounded-lg p-3 mt-3">
            <div className="flex items-center">
              <div className="flex-shrink-0 h-8 w-8">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-sm font-medium">
                  {account?.Name?.charAt(0)?.toUpperCase() || '?'}
                </div>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900">{account?.Name}</p>
                <p className="text-xs text-gray-500">{account?.Industry}</p>
              </div>
            </div>
          </div>

          {/* Reason Selection - Only shown when blacklisting */}
          {isBlacklisting && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for blacklisting <span className="text-red-500">*</span>
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                required
              >
                <option value="">Select a reason</option>
                {reasonOptions.map(option => (
                  <option key={option.id} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Notes Field - Always shown */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes {isBlacklisting && '(Optional)'}
            </label>
            <textarea
              required={!isBlacklisting}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder={isBlacklisting 
                ? 'Enter any additional notes about why this account is being blacklisted...'
                : 'Enter any notes about removing this account from the blacklist...'
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-center">
                <svg className="w-4 h-4 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-red-800 text-sm">{error}</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end space-x-3">
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading}
            className={`px-4 py-2 text-sm font-medium text-white rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
              isBlacklisting
                ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                : 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
            }`}
          >
            {isLoading ? (
              <div className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </div>
            ) : (
              isBlacklisting ? 'Blacklist Account' : 'Remove from Blacklist'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BlacklistConfirmationModal; 