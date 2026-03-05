import React from 'react';

const WebsiteInput = ({ 
  value, 
  onChange, 
  placeholder = "example.com or https://example.com",
  disabled = false,
  className = ""
}) => {
  return (
    <div className={`space-y-2 ${className}`}>
      <input
        type="text"
        name="Website"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
      />
    </div>
  );
};

export default WebsiteInput;