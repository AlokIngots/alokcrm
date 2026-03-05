import React from 'react';

const MoneyInput = ({ 
  value, 
  onChange, 
  unit, 
  onUnitChange, 
  placeholder = "Enter amount",
  disabled = false,
  className = "",
  name = "amount",
  required = false
}) => {
  // Prevent scroll wheel from changing the number value
  const handleWheel = (e) => {
    e.target.blur();
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex gap-2">
        <input
          type="number"
          name={name}
          value={value}
          onChange={onChange}
          onWheel={handleWheel}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          min="0"
          step="0.01"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
        />
        <div className="flex border border-gray-300 rounded-lg overflow-hidden">
          {['INR', 'Lakhs', 'Crores'].map((unitOption) => (
            <button
              key={unitOption}
              type="button"
              onClick={() => onUnitChange(unitOption)}
              disabled={disabled}
              className={`px-2 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed ${
                unit === unitOption
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50 disabled:hover:bg-white'
              } ${unitOption !== 'INR' ? 'border-l border-gray-300' : ''}`}
            >
              {unitOption}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MoneyInput; 