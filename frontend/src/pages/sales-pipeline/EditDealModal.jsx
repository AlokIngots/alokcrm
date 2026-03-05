import React, { useState, useEffect } from 'react';
import { formatIndianCurrency } from './utils/formatters';
import MoneyInput from '../../components/MoneyInput';
import { convertTurnover, convertTurnoverForDisplay } from '../accounts/utils/accountUtils';

const EditDealModal = ({ isOpen, onClose, deal, onUpdate }) => {
  const [formData, setFormData] = useState({
    DealValue: '',
    ExpectedClosureDate: ''
  });
  const [dealValueUnit, setDealValueUnit] = useState('INR');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isOpen && deal) {
      // Format the date for input (YYYY-MM-DD format)
      const formatDateForInput = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toISOString().split('T')[0];
      };

      // Convert deal value for display
      const displayValue = convertTurnoverForDisplay(deal.DealValue);
      setFormData({
        DealValue: displayValue.amount,
        ExpectedClosureDate: formatDateForInput(deal.ExpectedClosureDate)
      });
      setDealValueUnit(displayValue.unit);
      setErrors({});
    }
  }, [isOpen, deal]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    const newErrors = {};
    if (!formData.DealValue || parseFloat(formData.DealValue) <= 0) {
      newErrors.DealValue = 'Deal value must be greater than 0';
    }
    if (!formData.ExpectedClosureDate) {
      newErrors.ExpectedClosureDate = 'Expected closure date is required';
    } else {
      const selectedDate = new Date(formData.ExpectedClosureDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (selectedDate < today) {
        newErrors.ExpectedClosureDate = 'Expected closure date cannot be in the past';
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Convert deal value to INR
    const convertedDealValue = convertTurnover(formData.DealValue.trim(), dealValueUnit);
    if (convertedDealValue === null || convertedDealValue <= 0) {
      setErrors({ DealValue: 'Deal value must be a positive number' });
      return;
    }

    setIsSubmitting(true);
    try {
      await onUpdate(deal.ID, {
        DealValue: convertedDealValue,
        ExpectedClosureDate: formData.ExpectedClosureDate
      });
      onClose();
    } catch (error) {
      setErrors({ submit: error.message || 'Failed to update deal' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  if (!isOpen || !deal) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Edit Deal</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            {/* Deal Info */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-2">{deal.AccountName}</h3>
              <p className="text-xs text-gray-600">{deal.ServiceType}</p>
              <p className="text-xs text-gray-500 mt-1">Current Value: {formatIndianCurrency(deal.DealValue)}</p>
            </div>

            {/* Deal Value */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
               Estimated Annual Deal Value *
              </label>
              <MoneyInput
                value={formData.DealValue}
                unit={dealValueUnit}
                onChange={handleChange}
                onUnitChange={setDealValueUnit}
                name="DealValue"
                placeholder="Enter deal value"
                required={true}
                disabled={isSubmitting}
                className={errors.DealValue ? 'border-red-300' : ''}
              />
              {errors.DealValue && (
                <p className="mt-1 text-sm text-red-600">{errors.DealValue}</p>
              )}
            </div>

            {/* Expected Closure Date */}
            <div>
              <label htmlFor="ExpectedClosureDate" className="block text-sm font-medium text-gray-700 mb-1">
                Expected Closure Date *
              </label>
              <input
                type="date"
                id="ExpectedClosureDate"
                name="ExpectedClosureDate"
                value={formData.ExpectedClosureDate}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.ExpectedClosureDate ? 'border-red-300' : 'border-gray-300'
                }`}
                disabled={isSubmitting}
              />
              {errors.ExpectedClosureDate && (
                <p className="mt-1 text-sm text-red-600">{errors.ExpectedClosureDate}</p>
              )}
            </div>

            {/* Submit Error */}
            {errors.submit && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-sm text-red-600">{errors.submit}</p>
              </div>
            )}
          </div>

          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Updating...' : 'Update Deal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditDealModal;