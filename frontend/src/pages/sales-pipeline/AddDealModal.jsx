import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { accountsApi } from '../accounts/api/accounts';
import { contactsApi } from '../contacts/api/contacts';
import { usersApi } from '../users/api/users';
import { getDivisionOptions } from '../../config/divisions';
import { getServiceTypesByDivision } from '../../config/service-types';
import { getLeadSourceOptions } from '../../config/lead-sources';
import MoneyInput from '../../components/MoneyInput';
import { convertTurnover } from '../accounts/utils/accountUtils';
import { filterSalespeople } from '../../config/access-control';

const AddDealModal = ({ isOpen, onClose, onDealCreated }) => {
  const [formData, setFormData] = useState({
    AccountID: '',
    ContactID: '',
    SalespersonECode: '',
    Division: '',
    ServiceType: '',
    DealValue: '',
    ExpectedClosureDate: '',
    LeadGeneratedBy: '',
    LeadSource: '',
    Notes: ''
  });

  const [accounts, setAccounts] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [users, setUsers] = useState([]);
  const [salespeople, setSalespeople] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [dealValueUnit, setDealValueUnit] = useState('INR');
  const [blacklistStatus, setBlacklistStatus] = useState(null);
  const [isLoadingBlacklist, setIsLoadingBlacklist] = useState(false);

  // Get division and lead source options
  const divisionOptions = useMemo(() => getDivisionOptions(), []);
  const leadSourceOptions = useMemo(() => getLeadSourceOptions(), []);

  // Get service types based on selected division
  const serviceTypeOptions = useMemo(() => {
    return getServiceTypesByDivision(formData.Division);
  }, [formData.Division]);


  // Fetch contacts for selected account
  const fetchContactsForAccount = useCallback(async (accountId) => {
    setIsLoadingContacts(true);
    setContacts([]);
    
    try {
      const accountContacts = await contactsApi.getContactsByCompanyId(accountId);
      
      const validContacts = Array.isArray(accountContacts) ? accountContacts : [];
      setContacts(validContacts);
    } catch (err) {
      setError(`Failed to load contacts for account ID ${accountId}: ${err.message}`);
      setContacts([]);
    } finally {
      setIsLoadingContacts(false);
    }
  }, []);

  // Fetch blacklist status for selected account
  const fetchBlacklistStatus = useCallback(async (accountId) => {
    setIsLoadingBlacklist(true);
    setBlacklistStatus(null);
    
    try {
      const blacklistData = await accountsApi.getBlacklistStatus(accountId);
      setBlacklistStatus(blacklistData);
    } catch (err) {
      console.error(`Failed to load blacklist status for account ID ${accountId}:`, err);
      setBlacklistStatus(null);
    } finally {
      setIsLoadingBlacklist(false);
    }
  }, []);

  // Reset service type when division changes
  useEffect(() => {
    if (formData.Division) {
      setFormData(prev => ({ ...prev, ServiceType: '' }));
    }
  }, [formData.Division]);

  // Handle account selection change
  useEffect(() => {
    // Always reset contact selection when account changes
    if (formData.ContactID) {
      setFormData(prev => ({ ...prev, ContactID: '' }));
    }
    
    if (formData.AccountID) {
      const accountId = parseInt(formData.AccountID);
      fetchContactsForAccount(accountId);
      fetchBlacklistStatus(accountId);
    } else {
      setContacts([]);
      setBlacklistStatus(null);
      setIsLoadingContacts(false);
      setIsLoadingBlacklist(false);
    }
  }, [formData.AccountID, fetchContactsForAccount, fetchBlacklistStatus]);

  // Fetch initial data when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchInitialData();
    }
  }, [isOpen]);

  const fetchInitialData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [accountsData, usersData] = await Promise.all([
        accountsApi.getAllAccounts(),
        usersApi.getAllUsers()
      ]);

      setAccounts(Array.isArray(accountsData) ? accountsData : []);
      setUsers(Array.isArray(usersData) ? usersData : []);
      // Filter users to show only salespeople
      const salespeople = filterSalespeople(Array.isArray(usersData) ? usersData : []);
      setSalespeople(salespeople);
    } catch (err) {
      setError('Failed to load form data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // Check if account is blacklisted
      if (blacklistStatus && blacklistStatus.blacklist) {
        throw new Error('Cannot create deal for blacklisted account. Please contact the admin if you wish to proceed.');
      }

      // Validate required fields
      const requiredFields = [
        'AccountID', 'ContactID', 'SalespersonECode', 'Division', 
        'ServiceType', 'DealValue', 'ExpectedClosureDate', 'LeadGeneratedBy', 'LeadSource'
      ];

      for (const field of requiredFields) {
        if (!formData[field]) {
          throw new Error(`${field.replace(/([A-Z])/g, ' $1').trim()} is required`);
        }
      }

      // Validate and convert deal value
      if (!formData.DealValue.trim()) {
        throw new Error('Deal value is required');
      }
      
      const convertedDealValue = convertTurnover(formData.DealValue.trim(), dealValueUnit);
      if (convertedDealValue === null || convertedDealValue <= 0) {
        throw new Error('Deal value must be a positive number');
      }

      // Validate date
      const expectedDate = new Date(formData.ExpectedClosureDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (expectedDate < today) {
        throw new Error('Expected closure date cannot be in the past');
      }

      // Prepare payload - use the contact's id field as ContactID
      const selectedContact = contacts.find(contact => contact.id === parseInt(formData.ContactID));
      if (!selectedContact) {
        throw new Error('Please select a valid contact');
      }

      const payload = {
        AccountID: parseInt(formData.AccountID),
        SalespersonECode: formData.SalespersonECode,
        ContactID: selectedContact.id,
        Division: formData.Division,
        ServiceType: formData.ServiceType,
        DealValue: convertedDealValue,
        ExpectedClosureDate: formData.ExpectedClosureDate,
        LeadGeneratedBy: formData.LeadGeneratedBy,
        LeadSource: formData.LeadSource,
        Stage: 'NEW',
        Notes: formData.Notes.trim() || null
      };

      await onDealCreated(payload);
      handleClose();
    } catch (err) {
      setError(err.message || 'Failed to create deal. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setFormData({
      AccountID: '',
      ContactID: '',
      SalespersonECode: '',
      Division: '',
      ServiceType: '',
      DealValue: '',
      ExpectedClosureDate: '',
      LeadGeneratedBy: '',
      LeadSource: '',
      Notes: ''
    });
    setContacts([]);
    setBlacklistStatus(null);
    setError(null);
    setIsLoadingContacts(false);
    setIsLoadingBlacklist(false);
    setDealValueUnit('INR');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Create New Deal</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="flex items-center">
              <svg className="w-4 h-4 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-red-800 text-sm">{error}</span>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="p-6 flex justify-center">
            <div className="flex items-center">
              <svg className="animate-spin h-6 w-6 text-blue-600 mr-3" fill="none" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle>
                <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75"></path>
              </svg>
              <span className="text-gray-600">Loading form data...</span>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Account Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Account <span className="text-red-500">*</span>
              </label>
              <select
                name="AccountID"
                value={formData.AccountID}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select an account</option>
                {accounts
                  .sort((a, b) => a.Name.localeCompare(b.Name))
                  .map(account => (
                    <option key={account.id} value={account.id}>
                      {account.Name}
                      {account.Division && ` - ${account.Division}`}
                      {account.Location && ` - ${account.Location}`}
                    </option>
                  ))}
              </select>

              {/* Blacklist Warning */}
              {formData.AccountID && (
                <div className="mt-2">
                  {isLoadingBlacklist ? (
                    <div className="flex items-center text-sm text-gray-500">
                      <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle>
                        <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75"></path>
                      </svg>
                      Checking blacklist status...
                    </div>
                  ) : blacklistStatus && blacklistStatus.blacklist ? (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <div className="flex items-start">
                        <svg className="w-5 h-5 text-red-400 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                        <div>
                          <p className="text-sm font-medium text-red-800">
                            This company is blacklisted due to {blacklistStatus.reason}. Please contact the admin if you wish to proceed.
                          </p>
                          {blacklistStatus.notes && (
                            <p className="text-sm text-red-700 mt-1">
                              <span className="font-medium">Notes:</span> {blacklistStatus.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            {/* Contact Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contact <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  name="ContactID"
                  value={formData.ContactID}
                  onChange={handleInputChange}
                  required
                  disabled={!formData.AccountID || isLoadingContacts}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">
                    {!formData.AccountID 
                      ? 'Select an account first'
                      : isLoadingContacts 
                        ? 'Loading contacts...'
                        : contacts.length === 0
                          ? 'No contacts found for this account'
                          : 'Select a contact'
                    }
                  </option>
                  {contacts.map(contact => (
                    <option key={contact.id} value={contact.id}>
                      {contact.Name} - {contact.Designation}
                    </option>
                  ))}
                </select>
                {isLoadingContacts && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <svg className="animate-spin h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle>
                      <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75"></path>
                    </svg>
                  </div>
                )}
              </div>
            </div>

            {/* Salesperson Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Salesperson <span className="text-red-500">*</span>
              </label>
              <select
                name="SalespersonECode"
                value={formData.SalespersonECode}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select a salesperson</option>
                {salespeople.map(user => (
                  <option key={user.ECode} value={user.ECode}>
                    {user.Name} ({user.ECode})
                  </option>
                ))}
              </select>
            </div>

            {/* Division Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Division <span className="text-red-500">*</span>
              </label>
              <select
                name="Division"
                value={formData.Division}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select a division</option>
                {divisionOptions.map(division => (
                  <option key={division.id} value={division.id}>
                    {division.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Service Type Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Service Type <span className="text-red-500">*</span>
              </label>
              <select
                name="ServiceType"
                value={formData.ServiceType}
                onChange={handleInputChange}
                required
                disabled={!formData.Division}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="">
                  {formData.Division ? 'Select a service type' : 'Select a division first'}
                </option>
                {serviceTypeOptions.map(serviceType => (
                  <option key={serviceType} value={serviceType}>
                    {serviceType}
                  </option>
                ))}
              </select>
            </div>

            {/* Deal Value */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estimated Annual Deal Value <span className="text-red-500">*</span>
              </label>
              <MoneyInput
                value={formData.DealValue}
                unit={dealValueUnit}
                onChange={(e) => setFormData(prev => ({ ...prev, DealValue: e.target.value }))}
                onUnitChange={setDealValueUnit}
                name="DealValue"
                placeholder="Enter deal value"
                required={true}
              />
            </div>

            {/* Expected Closure Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Expected Closure Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="ExpectedClosureDate"
                value={formData.ExpectedClosureDate}
                onChange={handleInputChange}
                required
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Lead Generated By */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Lead Generated By <span className="text-red-500">*</span>
              </label>
              <select
                name="LeadGeneratedBy"
                value={formData.LeadGeneratedBy}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select lead generator</option>
                {users.map(user => (
                  <option key={user.ECode} value={user.ECode}>
                    {user.Name} ({user.ECode})
                  </option>
                ))}
              </select>
            </div>

            {/* Lead Source */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Lead Source <span className="text-red-500">*</span>
              </label>
              <select
                name="LeadSource"
                value={formData.LeadSource}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select lead source</option>
                {leadSourceOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Notes/Comments */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes/Comments
              </label>
              <textarea
                name="Notes"
                value={formData.Notes}
                onChange={handleInputChange}
                rows={3}
                placeholder="Enter any additional notes or comments"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>

            {/* Form Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || isLoadingContacts || (blacklistStatus && blacklistStatus.blacklist)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle>
                      <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75"></path>
                    </svg>
                    Creating...
                  </>
                ) : (
                  'Create Deal'
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default AddDealModal;