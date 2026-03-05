import React, { useState, useEffect } from 'react';
import { getReasonsByStage } from '../../config/deal-status-reasons-master';

const DealStatusModal = ({ 
  isOpen, 
  onClose, 
  deal, 
  newStage, 
  existingStatus, 
  isEditing = false,
  onSubmit
}) => {
  const [formData, setFormData] = useState({
    reason: '',
    customReason: '',
    notes: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  // Reset form when modal opens/closes or deal changes
  useEffect(() => {
    if (isOpen && deal) {
      if (isEditing && existingStatus) {
        setFormData({
          reason: existingStatus.Reason || '',
          customReason: existingStatus.CustomReason || '',
          notes: existingStatus.Notes || ''
        });
      } else {
        setFormData({
          reason: '',
          customReason: '',
          notes: ''
        });
      }
      setErrors({});
    }
  }, [isOpen, deal, existingStatus, isEditing]);

  // Get available reasons for the current stage
  const availableReasons = getReasonsByStage(newStage || deal?.Stage);

  // Check if "Other" is selected
  const isOtherSelected = formData.reason === 'other';

  // Determine if custom reason should be shown and required
  const shouldShowCustomReason = isOtherSelected;
  const isCustomReasonRequired = isOtherSelected;

  const getModalTitle = () => {
    if (isEditing && existingStatus) {
      if (existingStatus.Status !== newStage) {
        // Moving between status stages
        const fromStage = existingStatus.Status === 'DEAL_ON_HOLD' ? 'Hold' : 'Lost';
        const toStage = newStage === 'DEAL_ON_HOLD' ? 'Hold' : 'Lost';
        return `Update "${deal.AccountName}" from ${fromStage} to ${toStage}`;
      } else {
        // Editing same stage
        return `Edit ${newStage === 'DEAL_ON_HOLD' ? 'Hold' : 'Lost'} Reason`;
      }
    } else {
      // New status
      return `Why is "${deal.AccountName}" being moved to ${newStage === 'DEAL_ON_HOLD' ? 'Hold' : 'Lost'}?`;
    }
  };

  // Handle form input changes
  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Clear related errors
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: null
      }));
    }

    // Clear custom reason when not selecting "other"
    if (field === 'reason' && value !== 'other') {
      setFormData(prev => ({
        ...prev,
        customReason: ''
      }));
    }
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {};

    if (!formData.reason) {
      newErrors.reason = 'Please select a reason';
    }

    if (isCustomReasonRequired && !formData.customReason.trim()) {
      newErrors.customReason = 'Please provide a custom reason';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        reason: formData.reason,
        customReason: formData.customReason.trim(),
        notes: formData.notes.trim()
      });
      onClose();
    } catch (error) {
      console.error('Error submitting deal status:', error);
      setErrors({ submit: error.message || 'Failed to update deal status' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Don't render if not open
  if (!isOpen || !deal) return null;

 
  
  const actionText = isEditing ? 'Update Status' : 'Confirm Move';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            {getModalTitle()}
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Deal: {deal.AccountName}
          </p>
        </div>

        {/* Modal Content */}
        <form onSubmit={handleSubmit} className="px-6 py-4">
          {/* Reason Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.reason}
              onChange={(e) => handleInputChange('reason', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.reason ? 'border-red-500' : 'border-gray-300'
              }`}
              disabled={isSubmitting}
            >
              <option value="">Select a reason...</option>
              {availableReasons.map(reason => (
                <option key={reason.id} value={reason.id}>
                  {reason.label}
                </option>
              ))}
            </select>
            {errors.reason && (
              <p className="mt-1 text-sm text-red-600">{errors.reason}</p>
            )}
          </div>

          {/* Custom Reason Input */}
          {shouldShowCustomReason && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Custom Reason {isCustomReasonRequired && <span className="text-red-500">*</span>}
              </label>
              <input
                type="text"
                value={formData.customReason}
                onChange={(e) => handleInputChange('customReason', e.target.value)}
                placeholder="Please specify the reason"
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.customReason ? 'border-red-500' : 'border-gray-300'
                }`}
                disabled={isSubmitting}
              />
              {errors.customReason && (
                <p className="mt-1 text-sm text-red-600">{errors.customReason}</p>
              )}
            </div>
          )}

          {/* Notes */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Additional Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              placeholder="Any additional information or context..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isSubmitting}
            />
          </div>

          {/* Error Message */}
          {errors.submit && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{errors.submit}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Saving...' : actionText}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DealStatusModal;