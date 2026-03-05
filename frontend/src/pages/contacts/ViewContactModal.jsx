import React from 'react';

const ViewContactModal = ({ isOpen, onClose, contact }) => {
  if (!isOpen || !contact) return null;

  const fieldGroups = [
    {
      title: "Contact Information",
      fields: [
        { label: "Name", value: contact.Name, required: true },
        { label: "Designation", value: contact.Designation, required: true },
        { label: "Account", value: contact.Account, required: true },
      ]
    },
    {
      title: "Contact Details",
      fields: [
        { 
          label: "Primary Email", 
          value: contact.Email1, 
          required: true,
          type: "email"
        },
        { 
          label: "Secondary Email", 
          value: contact.Email2,
          type: "email"
        },
        { 
          label: "Primary Phone", 
          value: contact.Phone1,
          type: "phone"
        },
        { 
          label: "Secondary Phone", 
          value: contact.Phone2,
          type: "phone"
        },
      ]
    },
    {
      title: "Additional Information",
      fields: [
        { label: "Notes/Comments", value: contact.Notes, multiline: true },
      ]
    }
  ];

  const renderFieldValue = (field) => {
    if (!field.value) {
      return <span className="text-gray-400 italic">Not provided</span>;
    }

    if (field.type === "email") {
      return (
        <a
          href={`mailto:${field.value}`}
          className="text-blue-600 hover:text-blue-800 hover:underline transition-colors"
          title={`Send email to ${field.value}`}
        >
          {field.value}
        </a>
      );
    }

    if (field.type === "phone") {
      return (
        <a
          href={`tel:${field.value}`}
          className="text-green-600 hover:text-green-800 hover:underline transition-colors"
          title={`Call ${field.value}`}
        >
          {field.value}
        </a>
      );
    }

    if (field.multiline) {
      return (
        <div className="text-gray-900 whitespace-pre-wrap">
          {field.value}
        </div>
      );
    }

    return <span className="text-gray-900">{field.value}</span>;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 sticky top-0 bg-white rounded-t-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="flex-shrink-0 h-12 w-12">
                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center text-white text-lg font-medium">
                  {contact.Name?.charAt(0)?.toUpperCase() || '?'}
                </div>
              </div>
              <div className="ml-4">
                <h2 className="text-xl font-semibold text-gray-900">{contact.Name}</h2>
                <p className="text-sm text-gray-600">
                  {contact.Designation} at {contact.Account}
                </p>
              </div>
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
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          <div className="space-y-8">
            {fieldGroups.map((group, groupIndex) => (
              <div key={groupIndex}>
                <h3 className="text-lg font-medium text-gray-900 mb-4 border-b border-gray-200 pb-2">
                  {group.title}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {group.fields.map((field, fieldIndex) => (
                    <div key={fieldIndex} className={field.multiline ? "md:col-span-2" : ""}>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {field.label}
                        {field.required && <span className="text-red-500 ml-1">*</span>}
                      </label>
                      <div className={`${field.multiline ? 'min-h-[80px]' : ''} text-sm`}>
                        {renderFieldValue(field)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ViewContactModal;