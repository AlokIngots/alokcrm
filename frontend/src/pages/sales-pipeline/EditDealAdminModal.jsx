import React, { useState, useEffect } from 'react';
import { adminDealsApi } from '../../api/admin-deals';
import { accountsApi } from '../accounts/api/accounts';
import { contactsApi } from '../contacts/api/contacts';
import { usersApi } from '../users/api/users';
import { getDivisionOptions } from '../../config/divisions';
import { getServiceTypesByDivision } from '../../config/service-types';
import { getLeadSourceOptions } from '../../config/lead-sources';
import MoneyInput from '../../components/MoneyInput';
import { convertTurnover, convertTurnoverForDisplay } from '../accounts/utils/accountUtils';

const EditDealAdminModal = ({ isOpen, onClose, deal, onDealUpdated }) => {
  const [formData, setFormData] = useState({
    AccountID: '',
    SalespersonECode: '',
    ContactID: '',
    Division: '',
    ServiceType: '',
    DealValue: '',
    ExpectedClosureDate: '',
    LeadGeneratedBy: '',
    LeadSource: '',
    Notes: '',
    KAMECode: ''
  });

  const [dropdownOptions, setDropdownOptions] = useState({
    accounts: [],
    contacts: [],
    users: [],
    salespeople: [],
    leadGenerators: [],
    kamUsers: []
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [error, setError] = useState(null);
  const [dealValueUnit, setDealValueUnit] = useState('INR');


  useEffect(() => {
    if (!deal || !isOpen) return;

    // Convert deal value for display
    const displayValue = convertTurnoverForDisplay(deal.DealValue);

    setFormData({
      AccountID: deal.AccountID ? deal.AccountID.toString() : '',
      SalespersonECode: deal.SalespersonECode || '',
      ContactID: deal.ContactID ? deal.ContactID.toString() : '',
      Division: deal.Division || '',
      ServiceType: deal.ServiceType || '',
      DealValue: displayValue.amount,
      ExpectedClosureDate: deal.ExpectedClosureDate
        ? deal.ExpectedClosureDate.split('T')[0]
        : '',
      LeadGeneratedBy: deal.LeadGeneratedBy || '',
      LeadSource: deal.LeadSource || '',
      Notes: deal.Notes || '',
      KAMECode: deal.KAMECode || ''
    });

    setDealValueUnit(displayValue.unit);
    // NOTE: Contacts will be loaded automatically by the effect below.
  }, [deal, isOpen]);


  useEffect(() => {
    if (!isOpen) return;

    const loadDropdownOptions = async () => {
      setIsLoadingOptions(true);
      setError(null);

      try {
        const [accounts, users] = await Promise.all([
          accountsApi.getAllAccounts(),
          usersApi.getAllUsers()
        ]);

        const salespeople = users.filter((u) =>
          ['MBD Sales Person', 'SOP Sales Person', 'Sales Manager'].includes(
            u.Role
          )
        );

        const leadGenerators = users.filter((u) => u.Role === 'Lead Generator');

        const kamUsers = users.filter((u) =>
          ['Sales Manager', 'MBD Sales Person', 'SOP Sales Person'].includes(
            u.Role
          )
        );

        setDropdownOptions((prev) => ({
          ...prev, // preserve contacts that may already be set
          accounts,
          users,
          salespeople,
          leadGenerators,
          kamUsers
        }));
      } catch (e) {
        setError('Failed to load form options. Please try again.');
      } finally {
        setIsLoadingOptions(false);
      }
    };

    loadDropdownOptions();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    // Clear contacts if no account selected
    if (!formData.AccountID) {
      setDropdownOptions((prev) => ({ ...prev, contacts: [] }));
      return;
    }

    const controller = new AbortController();

    const loadContactsForAccount = async (accountId, signal) => {
      try {
        const contacts = await contactsApi.getContactsByCompanyId(
          accountId,
          signal
        );
        const validContacts = Array.isArray(contacts) ? contacts : [];
        setDropdownOptions((prev) => ({ ...prev, contacts: validContacts }));
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Error loading contacts:', err);
          setDropdownOptions((prev) => ({ ...prev, contacts: [] }));
        }
      }
    };

    loadContactsForAccount(formData.AccountID, controller.signal);

    // Abort previous fetch if AccountID changes or modal closes
    return () => controller.abort();
  }, [isOpen, formData.AccountID]);
 const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleMoneyInputChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      DealValue: e.target.value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
 
      const updateData = {};

      Object.keys(formData).forEach((key) => {
        const newValue = formData[key];
        let originalValue = deal[key];

        // normalise special cases for comparison
        if (key === 'ExpectedClosureDate' && originalValue) {
          originalValue = originalValue.split('T')[0];
        }

        const normNew = newValue === '' ? null : newValue;
        const normOrig =
          originalValue === '' || originalValue === undefined
            ? null
            : originalValue;

        if (normNew !== normOrig) {
          updateData[key] = normNew ?? ''; // send empty string to clear value
        }
      });

      // Convert numeric fields
      if (updateData.AccountID) updateData.AccountID = parseInt(updateData.AccountID);
      if (updateData.ContactID) updateData.ContactID = parseInt(updateData.ContactID);

      if (updateData.DealValue) {
        const converted = convertTurnover(
          updateData.DealValue.toString().trim(),
          dealValueUnit
        );
        if (!converted || converted <= 0)
          throw new Error('Deal value must be a positive number');
        updateData.DealValue = converted;
      }

      const res = await adminDealsApi.editDeal(deal.ID, updateData);
      onDealUpdated(res.deal);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to update deal. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const serviceTypeOptions = getServiceTypesByDivision(formData.Division).map(
    (type) => ({ value: type, label: type })
  );

  if (!isOpen || !deal) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Edit Deal</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Account */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Account
              </label>
              <select
                name="AccountID"
                value={formData.AccountID}
                onChange={handleInputChange}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                disabled={isLoadingOptions}
              >
                <option value="">Select Account</option>
                {dropdownOptions.accounts
                  .sort((a, b) => a.Name.localeCompare(b.Name))
                  .map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.Name}
                      {acc.Division && ` - ${acc.Division}`}
                      {acc.Location && ` - ${acc.Location}`}
                    </option>
                  ))}
              </select>
            </div>

            {/* Contact */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contact
              </label>
              <select
                name="ContactID"
                value={formData.ContactID}
                onChange={handleInputChange}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                disabled={!formData.AccountID}
              >
                <option value="">
                  {!formData.AccountID
                    ? 'Select an account first'
                    : dropdownOptions.contacts.length === 0
                    ? 'No contacts found for this account'
                    : 'Select Contact'}
                </option>
                {dropdownOptions.contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.Name} - {c.Designation}
                  </option>
                ))}
              </select>
            </div>

            {/* Salesperson */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Salesperson
              </label>
              <select
                name="SalespersonECode"
                value={formData.SalespersonECode}
                onChange={handleInputChange}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select Salesperson</option>
                {dropdownOptions.salespeople.map((p) => (
                  <option key={p.ECode} value={p.ECode}>
                    {p.Name} ({p.ECode})
                  </option>
                ))}
              </select>
            </div>

            {/* KAM */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Key Account Manager
              </label>
              <select
                name="KAMECode"
                value={formData.KAMECode}
                onChange={handleInputChange}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select KAM</option>
                {dropdownOptions.kamUsers.map((k) => (
                  <option key={k.ECode} value={k.ECode}>
                    {k.Name} ({k.ECode})
                  </option>
                ))}
              </select>
            </div>

            {/* Division */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Division
              </label>
              <select
                name="Division"
                value={formData.Division}
                onChange={handleInputChange}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select Division</option>
                {getDivisionOptions().map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Service Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Service Type
              </label>
              <select
                name="ServiceType"
                value={formData.ServiceType}
                onChange={handleInputChange}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                disabled={!formData.Division}
              >
                <option value="">Select Service Type</option>
                {serviceTypeOptions.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Deal Value */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Deal Value
              </label>
              <MoneyInput
                value={formData.DealValue}
                unit={dealValueUnit}
                onChange={handleMoneyInputChange}
                onUnitChange={setDealValueUnit}
                name="DealValue"
                placeholder="Enter deal value"
                className="w-full"
              />
            </div>

            {/* Expected Closure Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Expected Closure Date
              </label>
              <input
                type="date"
                name="ExpectedClosureDate"
                value={formData.ExpectedClosureDate}
                onChange={handleInputChange}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Lead Generated By */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Lead Generated By
              </label>
              <select
                name="LeadGeneratedBy"
                value={formData.LeadGeneratedBy}
                onChange={handleInputChange}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select Lead Generator</option>
                {dropdownOptions.users.map((u) => (
                  <option key={u.ECode} value={u.ECode}>
                    {u.Name} ({u.ECode})
                  </option>
                ))}
              </select>
            </div>

            {/* Lead Source */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Lead Source
              </label>
              <select
                name="LeadSource"
                value={formData.LeadSource}
                onChange={handleInputChange}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select Lead Source</option>
                {getLeadSourceOptions().map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Notes */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              name="Notes"
              value={formData.Notes}
              onChange={handleInputChange}
              rows="4"
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter deal notes or comments..."
            />
          </div>

          {/* Footer */}
          <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isLoadingOptions}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Updating...' : 'Update Deal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditDealAdminModal;
