import React, { useState, useEffect } from 'react';
import { accountsApi } from './api/accounts';
import MoneyInput from '../../components/MoneyInput';
import WebsiteInput from './components/WebsiteInput';
import { convertTurnover, validateWebsite, formatWebsiteWithProtocol, convertTurnoverForDisplay } from './utils/accountUtils';
import { getIndustryOptions } from '../../config/industry-master';
import { getDivisionLabel } from '../../config/divisions';

const DIVISION_OPTIONS = [
  { value: 'TPT', label: 'Local' },
  { value: 'SCM', label: 'Export' },
];

const normalizeDivisionValue = (value) => {
  const raw = String(value || '').trim().toUpperCase();
  if (!raw) return '';
  if (['LOCAL', 'TPT', 'DOU01'].includes(raw)) return 'TPT';
  if (['EXPORT', 'EXPORTS', 'SCM', 'XPR'].includes(raw)) return 'SCM';
  return raw;
};

const EditAccountModal = ({ isOpen, onClose, onAccountUpdated, account }) => {
  const [formData, setFormData] = useState({
    Name: '',
    Industry: '',
    Turnover: '',
    Website: '',
    Division: '',
    Location: '',
    SCM_KAM: '',
    TPT_KAM: '',
    Notes: ''
  });
  const [turnoverUnit, setTurnoverUnit] = useState('INR');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Get industry options from config
  const industryOptions = getIndustryOptions();

  // Fetch users for KAM dropdowns
  const fetchUsers = async () => {
    try {
      setLoadingUsers(true);
      const userData = await accountsApi.getUsersForKAMSelection();
      setUsers(userData);
    } catch (err) {
      console.error('Error fetching users for KAM selection:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  // Fetch users when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen]);

  // Populate form when account prop changes
  useEffect(() => {
    if (account) {
      let displayTurnover = '';
      let displayUnit = 'INR';
      
      if (account.Turnover) {
        const turnoverDisplay = convertTurnoverForDisplay(account.Turnover);
        displayTurnover = turnoverDisplay.amount;
        displayUnit = turnoverDisplay.unit;
      }

      setFormData({
        Name: account.Name || '',
        Industry: account.Industry || '',
        Turnover: displayTurnover,
        Website: account.Website || '',
        Division: normalizeDivisionValue(account.Division || ''),
        Location: account.Location || '',
        SCM_KAM: account.SCM_KAM || '',
        TPT_KAM: account.TPT_KAM || '',
        Notes: account.Notes || ''
      });
      setTurnoverUnit(displayUnit);
    }
  }, [account]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // Validate website if provided
      if (formData.Website && !validateWebsite(formData.Website)) {
        throw new Error('Please enter a valid website URL (e.g., example.com or https://example.com)');
      }

      const payload = {
        Name: formData.Name.trim(),
        Industry: formData.Industry.trim()
      };

      // Add optional fields only if they have values or if they're being cleared
      if (formData.Turnover.trim()) {
        const convertedTurnover = convertTurnover(formData.Turnover.trim(), turnoverUnit);
        if (convertedTurnover !== null) {
          payload.Turnover = convertedTurnover;
        }
      } else if (account.Turnover) {
        // If turnover is cleared, set to null
        payload.Turnover = null;
      }
      
      if (formData.Website.trim()) {
        payload.Website = formatWebsiteWithProtocol(formData.Website.trim());
      }

      if (formData.Division.trim()) {
        payload.Division = formData.Division.trim();
      }

      if (formData.Location.trim()) {
        payload.Location = formData.Location.trim();
      }

      payload.SCM_KAM = formData.SCM_KAM.trim() === '' ? null : formData.SCM_KAM.trim();
      payload.TPT_KAM = formData.TPT_KAM.trim() === '' ? null : formData.TPT_KAM.trim();
      
      if (formData.Notes.trim()) {
        payload.Notes = formData.Notes.trim();
      }

      await onAccountUpdated(account.id, payload);
      onClose();
    } catch (err) {
      // Handle different types of errors
      let errorMessage = 'Failed to update account';
      
      if (err.message) {
        errorMessage = err.message;
      } else if (err.detail) {
        errorMessage = err.detail;
      } else if (typeof err === 'string') {
        errorMessage = err;
      }
      
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setError(null);
      onClose();
    }
  };

  if (!isOpen || !account) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Edit Account</h2>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-4">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Error</h3>
                  <p className="text-sm text-red-600 mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Account Information */}
          <div className="space-y-4 mb-6">
            <h3 className="text-sm font-medium text-gray-700">Account Information</h3>
            
            <div>
              <label htmlFor="Name" className="block text-sm font-medium text-gray-700 mb-1">
                Account Name *
              </label>
              <input
                type="text"
                id="Name"
                name="Name"
                value={formData.Name}
                onChange={handleInputChange}
                required
                placeholder="Enter account name"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="Industry" className="block text-sm font-medium text-gray-700 mb-1">
                Industry *
              </label>
              <select
                id="Industry"
                name="Industry"
                value={formData.Industry}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select an industry</option>
                {industryOptions.map((industry) => (
                  <option key={industry} value={industry}>
                    {industry}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="Division" className="block text-sm font-medium text-gray-700 mb-1">
                Sale Type
              </label>
              <select
                id="Division"
                name="Division"
                value={formData.Division}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, Division: normalizeDivisionValue(e.target.value) }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {DIVISION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
                {formData.Division &&
                  !DIVISION_OPTIONS.find((option) => option.value === formData.Division) && (
                    <option value={formData.Division}>{getDivisionLabel(formData.Division)}</option>
                  )}
              </select>
            </div>

            <div>
              <label htmlFor="Location" className="block text-sm font-medium text-gray-700 mb-1">
                Location
              </label>
              <input
                type="text"
                id="Location"
                name="Location"
                value={formData.Location}
                onChange={handleInputChange}
                placeholder="Enter location (e.g., Mumbai, Delhi, Bangalore)"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <MoneyInput
              value={formData.Turnover}
              unit={turnoverUnit}
              onChange={(e) => setFormData(prev => ({ ...prev, Turnover: e.target.value }))}
              onUnitChange={setTurnoverUnit}
              name="Turnover"
              placeholder="Enter annual turnover"
              required={false}
            />

            <div>
              <label htmlFor="Website" className="block text-sm font-medium text-gray-700 mb-1">
                Website
              </label>
              <WebsiteInput
                value={formData.Website}
                onChange={handleInputChange}
                required={false}
              />
            </div>

            <div>
              <label htmlFor="SCM_KAM" className="block text-sm font-medium text-gray-700 mb-1">
                Export Sales Coordinator
              </label>
              <select
                id="SCM_KAM"
                name="SCM_KAM"
                value={formData.SCM_KAM}
                onChange={handleInputChange}
                disabled={loadingUsers}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed"
              >
                <option value="">Select Export Sales Coordinator</option>
                {users.map((user) => (
                  <option key={user.ECode} value={user.ECode}>
                    {user.Name} ({user.ECode})
                  </option>
                ))}
              </select>
              {loadingUsers && (
                <p className="text-xs text-gray-500 mt-1">Loading users...</p>
              )}
            </div>

            <div>
              <label htmlFor="TPT_KAM" className="block text-sm font-medium text-gray-700 mb-1">
                Local Sales Coordinator
              </label>
              <select
                id="TPT_KAM"
                name="TPT_KAM"
                value={formData.TPT_KAM}
                onChange={handleInputChange}
                disabled={loadingUsers}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed"
              >
                <option value="">Select Local Sales Coordinator</option>
                {users.map((user) => (
                  <option key={user.ECode} value={user.ECode}>
                    {user.Name} ({user.ECode})
                  </option>
                ))}
              </select>
              {loadingUsers && (
                <p className="text-xs text-gray-500 mt-1">Loading users...</p>
              )}
            </div>

            <div>
              <label htmlFor="Notes" className="block text-sm font-medium text-gray-700 mb-1">
                Notes/Comments
              </label>
              <textarea
                id="Notes"
                name="Notes"
                value={formData.Notes}
                onChange={handleInputChange}
                rows={3}
                placeholder="Enter any additional notes or comments"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Updating...' : 'Update Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditAccountModal;
