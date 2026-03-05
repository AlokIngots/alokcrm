import React from 'react';
import { formatIndianCurrency } from './utils/accountUtils';
import { getIndustryColors } from '../../config/industry-master';
import { getDivisionLabel } from '../../config/divisions';

const ViewAccountModal = ({ isOpen, onClose, account }) => {
  if (!isOpen || !account) return null;

  const fieldGroups = [
    {
      title: "Account Information",
      fields: [
        { label: "Account Name", value: account.Name, required: true },
        { label: "Industry", value: account.Industry, required: true, type: "industry" },
        { label: "Sale Type", value: account.Division ? getDivisionLabel(account.Division) : '' },
        { label: "Location", value: account.Location },
      ]
    },
    {
      title: "Financial Information",
      fields: [
        { 
          label: "Annual Turnover", 
          value: account.Turnover, 
          type: "currency"
        },
      ]
    },
    {
      title: "Contact & Web Presence",
      fields: [
        { 
          label: "Website", 
          value: account.Website,
          type: "website"
        },
      ]
    },
    {
      title: "Key Account Managers",
      fields: [
        { label: "Export Sales Coordinator", value: account.SCM_KAM_Name },
        { label: "Local Sales Coordinator", value: account.TPT_KAM_Name },
      ]
    },
    {
      title: "Additional Information",
      fields: [
        { label: "Notes/Comments", value: account.Notes, multiline: true },
      ]
    }
  ];

  const renderFieldValue = (field) => {
    if (!field.value) {
      return <span className="text-gray-400 italic">Not provided</span>;
    }

    if (field.type === "website") {
      return (
        <a
          href={field.value.startsWith('http') ? field.value : `https://${field.value}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 hover:underline transition-colors"
          title={`Visit ${field.value}`}
        >
          {field.value}
        </a>
      );
    }

    if (field.type === "currency") {
      const numericAmount = parseFloat(field.value);
      if (!isNaN(numericAmount)) {
        return (
          <span className="text-gray-900 font-medium">
            {formatIndianCurrency(numericAmount)}
          </span>
        );
      }
      return <span className="text-gray-900">{field.value}</span>;
    }

    if (field.type === "industry") {
      const industryColors = getIndustryColors();
      const colorConfig = industryColors[field.value] || { bg: 'bg-gray-100', text: 'text-gray-800' };
      
      return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorConfig.bg} ${colorConfig.text}`}>
          {field.value}
        </span>
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
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 sticky top-0 bg-white rounded-t-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="flex-shrink-0 h-12 w-12">
                <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-lg font-medium">
                  {account.Name?.charAt(0)?.toUpperCase() || '?'}
                </div>
              </div>
              <div className="ml-4">
                <h2 className="text-xl font-semibold text-gray-900">{account.Name}</h2>
                <p className="text-sm text-gray-600">
                  {account.Industry && account.Location ? 
                    `${account.Industry} • ${account.Location}` : 
                    account.Industry || account.Location || 'Account Details'
                  }
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
            {fieldGroups.map((group, groupIndex) => {
              // Skip sections that have no data
              const hasData = group.fields.some(field => field.value);
              if (!hasData) return null;

              return (
                <div key={groupIndex}>
                  <h3 className="text-lg font-medium text-gray-900 mb-4 border-b border-gray-200 pb-2">
                    {group.title}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {group.fields.map((field, fieldIndex) => {
                      // Skip empty fields
                      if (!field.value) return null;
                      
                      return (
                        <div key={fieldIndex} className={field.multiline ? "md:col-span-2" : ""}>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            {field.label}
                            {field.required && <span className="text-red-500 ml-1">*</span>}
                          </label>
                          <div className={`${field.multiline ? 'min-h-[80px]' : ''} text-sm`}>
                            {renderFieldValue(field)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
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

export default ViewAccountModal;
