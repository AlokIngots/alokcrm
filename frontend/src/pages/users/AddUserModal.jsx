import React, { useState } from 'react';
import { getRoleOptions } from '../../config/roles-master';

const emptyForm = {
  ECode: '',
  Name: '',
  Role: '',
};

const AddUserModal = ({ isOpen, onClose, onUserAdded }) => {
  const [formData, setFormData] = useState(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const resetAndClose = () => {
    if (isSubmitting) return;
    setFormData(emptyForm);
    setError(null);
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!formData.ECode.trim()) {
      setError('Employee Code is required');
      return;
    }
    if (!formData.Name.trim()) {
      setError('Name is required');
      return;
    }
    if (!formData.Role.trim()) {
      setError('Role is required');
      return;
    }

    setIsSubmitting(true);
    try {
      await onUserAdded({
        ECode: formData.ECode.trim(),
        Name: formData.Name.trim(),
        Role: formData.Role.trim(),
      });
      setFormData(emptyForm);
      onClose();
    } catch (err) {
      setError(err?.message || err?.detail || 'Failed to create user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const roleOptions = getRoleOptions();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Add New Member</h2>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-4 mb-6">
            <div>
              <label htmlFor="ECode" className="block text-sm font-medium text-gray-700 mb-1">
                Employee Code *
              </label>
              <input
                type="text"
                id="ECode"
                name="ECode"
                value={formData.ECode}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter employee code"
              />
            </div>

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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter full name"
              />
            </div>

            <div>
              <label htmlFor="Role" className="block text-sm font-medium text-gray-700 mb-1">
                Role *
              </label>
              <select
                id="Role"
                name="Role"
                value={formData.Role}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a role</option>
                {roleOptions.map((roleOption) => (
                  <option key={roleOption.value} value={roleOption.value}>
                    {roleOption.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
            <button
              type="button"
              onClick={resetAndClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-60"
            >
              {isSubmitting ? 'Creating...' : 'Create Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddUserModal;
