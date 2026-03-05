import React, { useState, useEffect } from 'react';
import { adminDealsApi } from '../../api/admin-deals';

const EditActivityLogDatesModal = ({ isOpen, onClose, deal, activityLogs, onDatesUpdated }) => {
  const [dateEdits, setDateEdits] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Initialize date edits when modal opens or activity logs change
  useEffect(() => {
    if (isOpen && activityLogs) {
      const initialEdits = activityLogs.map(log => ({
        activity_log_id: log.ID,
        action: log.Action,
        user_name: log.UserName,
        current_created_at: log.CreatedAt,
        new_created_at: formatDateTimeForInput(log.CreatedAt),
        changed: false
      }));
      setDateEdits(initialEdits);
    }
  }, [isOpen, activityLogs]);

  const formatDateTimeForInput = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    // Format as YYYY-MM-DDTHH:MM for datetime-local input, preserving local timezone
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const formatDisplayDateTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const handleDateChange = (index, newDateTime) => {
    setDateEdits(prev => {
      const updated = [...prev];
      const originalDateTime = formatDateTimeForInput(updated[index].current_created_at);
      updated[index] = {
        ...updated[index],
        new_created_at: newDateTime,
        changed: newDateTime !== originalDateTime
      };
      return updated;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // Only include changed dates
      const changedEdits = dateEdits
        .filter(edit => edit.changed)
        .map(edit => ({
          activity_log_id: edit.activity_log_id,
          new_created_at: edit.new_created_at
        }));

      if (changedEdits.length === 0) {
        setError('No changes detected. Please modify at least one date to continue.');
        setIsSubmitting(false);
        return;
      }

      console.log('Submitting activity log date changes:', changedEdits);

      const result = await adminDealsApi.editActivityLogDates(deal.ID, changedEdits);
      
      onDatesUpdated(result);
      onClose();
    } catch (error) {
      console.error('Error updating activity log dates:', error);
      setError(error.message || 'Failed to update activity log dates. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetChanges = () => {
    if (activityLogs) {
      const resetEdits = activityLogs.map(log => ({
        activity_log_id: log.ID,
        action: log.Action,
        user_name: log.UserName,
        current_created_at: log.CreatedAt,
        new_created_at: formatDateTimeForInput(log.CreatedAt),
        changed: false
      }));
      setDateEdits(resetEdits);
    }
  };

  const getChangedCount = () => {
    return dateEdits.filter(edit => edit.changed).length;
  };

  if (!isOpen || !deal || !activityLogs) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Edit Activity Log Dates</h2>
            <p className="text-sm text-gray-600 mt-1">
              Modify the creation dates for activity log entries of "{deal.AccountName}"
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          {getChangedCount() > 0 && (
            <div className="mb-4 p-3 bg-blue-100 border border-blue-400 text-blue-700 rounded flex items-center justify-between">
              <span>{getChangedCount()} date(s) modified</span>
              <button
                type="button"
                onClick={resetChanges}
                className="text-sm underline hover:no-underline"
              >
                Reset all changes
              </button>
            </div>
          )}

          <div className="space-y-4 max-h-96 overflow-y-auto">
            {dateEdits.map((edit, index) => (
              <div
                key={edit.activity_log_id}
                className={`p-4 border rounded-lg ${
                  edit.changed ? 'border-blue-300 bg-blue-50' : 'border-gray-200'
                }`}
              >
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-center">
                  {/* Activity Description */}
                  <div className="lg:col-span-1">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-gray-900">
                        {edit.user_name}
                      </p>
                      <p className="text-sm text-gray-700">
                        {edit.action}
                      </p>
                    </div>
                  </div>

                  {/* Current Date Display */}
                  <div className="lg:col-span-1">
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Original Date
                    </label>
                    <p className="text-sm text-gray-900">
                      {formatDisplayDateTime(edit.current_created_at)}
                    </p>
                  </div>

                  {/* New Date Input */}
                  <div className="lg:col-span-1">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      New Date & Time
                    </label>
                    <input
                      type="datetime-local"
                      value={edit.new_created_at}
                      onChange={(e) => handleDateChange(index, e.target.value)}
                      className="w-full p-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                {edit.changed && (
                  <div className="mt-2 text-xs text-blue-600">
                    ✓ Date will be changed from {formatDisplayDateTime(edit.current_created_at)} to {formatDisplayDateTime(edit.new_created_at)}
                  </div>
                )}
              </div>
            ))}
          </div>

          {dateEdits.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p>No activity logs available for editing.</p>
            </div>
          )}

          {/* Footer */}
          <div className="flex justify-between items-center pt-6 border-t border-gray-200 mt-6">
            <div className="text-sm text-gray-600">
              {dateEdits.length} activity log entries • {getChangedCount()} modified
            </div>
            <div className="flex space-x-3">
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
                disabled={isSubmitting || getChangedCount() === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Updating...' : `Update ${getChangedCount()} Date${getChangedCount() !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditActivityLogDatesModal; 