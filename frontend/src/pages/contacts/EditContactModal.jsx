import React, { useState, useEffect } from 'react';
import { getDivisionLabel } from '../../config/divisions';

const EditContactModal = ({ isOpen, onClose, onContactUpdated, contact, accounts = [] }) => {
  const [formData, setFormData] = useState({
    Name: '',
    AccountID: '',
    Designation: '',
    Email1: '',
    Email2: '',
    Phone1: '',
    Phone2: '',
    Notes: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);



  // Update form data when contact prop changes
  useEffect(() => {
    if (contact) {
      // Find the account ID based on the account name or use existing AccountID
      const accountId = contact.AccountID || 
        (contact.Account ? accounts.find(c => c.Name === contact.Account)?.id : '') || 
        '';

      setFormData({
        Name: contact.Name || '',
        AccountID: accountId,
        Designation: contact.Designation || '',
        Email1: contact.Email1 || '',
        Email2: contact.Email2 || '',
        Phone1: contact.Phone1 || '',
        Phone2: contact.Phone2 || '',
        Notes: contact.Notes || ''
      });
    }
  }, [contact, accounts]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!contact) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Validate required fields
      if (!formData.Name.trim()) {
        throw new Error('Name is required');
      }
      if (!formData.AccountID) {
        throw new Error('Account is required');
      }
      if (!formData.Designation.trim()) {
        throw new Error('Designation is required');
      }
      if (!formData.Email1.trim()) {
        throw new Error('Primary email is required');
      }

      // Validate email formats
      if (!validateEmail(formData.Email1)) {
        throw new Error('Primary email format is invalid');
      }
      if (formData.Email2.trim() && !validateEmail(formData.Email2)) {
        throw new Error('Secondary email format is invalid');
      }

      // Create payload with all fields (including empty ones for updates)
      const payload = {
        Name: formData.Name.trim(),
        AccountID: parseInt(formData.AccountID),
        Designation: formData.Designation.trim(),
        Email1: formData.Email1.trim(),
        Email2: formData.Email2.trim() || null,
        Phone1: formData.Phone1.trim() || null,
        Phone2: formData.Phone2.trim() || null,
        Notes: formData.Notes.trim() || null
      };

      await onContactUpdated(contact.ContactID || contact.id, payload);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to update contact');
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

  if (!isOpen || !contact) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Edit Contact</h2>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-4">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Contact Information */}
          <div className="space-y-4 mb-6">
            <h3 className="text-sm font-medium text-gray-700">Contact Information</h3>
            
            <div>
              <label htmlFor="Name" className="block text-sm font-medium text-gray-700 mb-1">
                Name *
              </label>
              <input
                type="text"
                id="Name"
                name="Name"
                value={formData.Name}
                onChange={handleInputChange}
                required
                placeholder="Enter full name"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="AccountID" className="block text-sm font-medium text-gray-700 mb-1">
                Account *
              </label>
              <select
                id="AccountID"
                name="AccountID"
                value={formData.AccountID}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select an account</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.Name}
                    {account.Division && ` - ${getDivisionLabel(account.Division)}`}
                    {account.Location && ` - ${account.Location}`}
                  </option>
                ))}
              </select>
            </div>



            <div>
              <label htmlFor="Designation" className="block text-sm font-medium text-gray-700 mb-1">
                Designation *
              </label>
              <input
                type="text"
                id="Designation"
                name="Designation"
                value={formData.Designation}
                onChange={handleInputChange}
                required
                placeholder="Enter job title or designation"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Contact Details */}
          <div className="space-y-4 mb-6">
            <h3 className="text-sm font-medium text-gray-700">Contact Details</h3>
            
            <div>
              <label htmlFor="Email1" className="block text-sm font-medium text-gray-700 mb-1">
                Email 1 *
              </label>
              <input
                type="email"
                id="Email1"
                name="Email1"
                value={formData.Email1}
                onChange={handleInputChange}
                required
                placeholder="primary@email.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="Email2" className="block text-sm font-medium text-gray-700 mb-1">
                Email 2
              </label>
              <input
                type="email"
                id="Email2"
                name="Email2"
                value={formData.Email2}
                onChange={handleInputChange}
                placeholder="secondary@email.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="Phone1" className="block text-sm font-medium text-gray-700 mb-1">
                Phone 1
              </label>
              <input
                type="tel"
                id="Phone1"
                name="Phone1"
                value={formData.Phone1}
                onChange={handleInputChange}
                placeholder="9876543210"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="Phone2" className="block text-sm font-medium text-gray-700 mb-1">
                Phone 2
              </label>
              <input
                type="tel"
                id="Phone2"
                name="Phone2"
                value={formData.Phone2}
                onChange={handleInputChange}
                placeholder="9876543210"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Additional Information */}
          <div className="space-y-4 mb-6">
            <h3 className="text-sm font-medium text-gray-700">Additional Information</h3>
            
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
                placeholder="Any additional notes or comments"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              {isSubmitting ? 'Updating...' : 'Update Contact'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditContactModal;
