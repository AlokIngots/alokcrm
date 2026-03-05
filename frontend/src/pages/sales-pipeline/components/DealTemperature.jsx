import React, { useState, useRef, useEffect } from 'react';
import { FireIcon, ExclamationTriangleIcon, NoSymbolIcon } from '@heroicons/react/24/solid';

// Temperature configuration with icons and colors
const TEMPERATURE_CONFIG = {
  HOT: {
    label: 'Hot',
    description: 'High win probability',
    icon: FireIcon,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    badgeColor: 'bg-red-100 text-red-800'
  },
  WARM: {
    label: 'Warm',
    description: 'Moderate win probability',
    icon: ExclamationTriangleIcon,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    badgeColor: 'bg-yellow-100 text-yellow-800'
  },
  COLD: {
    label: 'Cold',
    description: 'Low win probability',
    icon: NoSymbolIcon,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    badgeColor: 'bg-blue-100 text-blue-800'
  }
};

const DealTemperature = ({ 
  deal, 
  isEditable = false, 
  onTemperatureChange, 
  compact = false,
  className = '' 
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const dropdownRef = useRef(null);

  const currentTemperature = deal?.Temperature;
  const temperatureConfig = currentTemperature ? TEMPERATURE_CONFIG[currentTemperature] : null;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isDropdownOpen]);

  const handleTemperatureSelect = async (temperature) => {
    if (isUpdating || !onTemperatureChange) return;

    setIsUpdating(true);
    setIsDropdownOpen(false);

    try {
      await onTemperatureChange(deal.ID, temperature);
    } catch (error) {
      console.error('Error updating temperature:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  // Don't render if no temperature and not editable (but always show for editable deals)
  if (!currentTemperature && !isEditable) {
    return null;
  }

  // Compact display for deal cards (with dropdown if editable)
  if (compact) {
    if (!isEditable) {
      // Read-only compact display
      return currentTemperature ? (
        <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${temperatureConfig.badgeColor} ${className}`}>
          <temperatureConfig.icon className="w-3 h-3 mr-1" />
          {temperatureConfig.label}
        </div>
      ) : null;
    }

    // Editable compact display with dropdown
    return (
      <div className={`relative ${className}`}>
        <div ref={dropdownRef} className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setIsDropdownOpen(!isDropdownOpen);
            }}
            disabled={isUpdating}
            className={`
              inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border transition-colors
              ${currentTemperature ? temperatureConfig.badgeColor : 'bg-gray-100 text-gray-600 border-gray-200'}
              hover:shadow-sm cursor-pointer
              ${isUpdating ? 'opacity-50 cursor-wait' : ''}
            `}
            title={currentTemperature ? `${temperatureConfig.label} - Click to change` : 'Set temperature'}
          >
            {isUpdating ? (
              <>
                <svg className="animate-spin w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle>
                  <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75"></path>
                </svg>
                Updating...
              </>
            ) : currentTemperature ? (
              <>
                <temperatureConfig.icon className="w-3 h-3 mr-1" />
                {temperatureConfig.label}
              </>
            ) : (
              <>
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Set Temp
              </>
            )}
          </button>

          {/* Dropdown */}
          {isDropdownOpen && (
            <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
              <div className="p-2 space-y-1">
                {Object.entries(TEMPERATURE_CONFIG).map(([temp, config]) => {
                  const Icon = config.icon;
                  const isSelected = currentTemperature === temp;
                  
                  return (
                    <button
                      key={temp}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        handleTemperatureSelect(temp);
                      }}
                      className={`
                        w-full flex items-center px-3 py-2 text-sm rounded-md transition-colors text-left
                        ${isSelected ? `${config.bgColor} ${config.color}` : 'hover:bg-gray-50'}
                      `}
                    >
                      <Icon className={`w-4 h-4 mr-3 ${config.color}`} />
                      <div>
                        <div className="font-medium">{config.label}</div>
                        <div className="text-xs text-gray-500">{config.description}</div>
                      </div>
                      {isSelected && (
                        <svg className="w-4 h-4 ml-auto text-green-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Modal display - always read-only, just show current temperature
  if (!currentTemperature) {
    return (
      <div className={className}>
        <label className="block text-sm font-medium text-gray-500 mb-2">Deal Temperature</label>
        <div className="text-sm text-gray-500 italic">No temperature set</div>
      </div>
    );
  }

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-500 mb-2">Deal Temperature</label>
      <div className={`flex items-center p-3 rounded-lg ${temperatureConfig.bgColor} ${temperatureConfig.borderColor} border-2`}>
        <temperatureConfig.icon className={`w-5 h-5 mr-3 ${temperatureConfig.color}`} />
        <div>
          <div className={`font-medium ${temperatureConfig.color}`}>
            {temperatureConfig.label}
          </div>
          <div className="text-sm text-gray-600">{temperatureConfig.description}</div>
        </div>
      </div>
    </div>
  );
};

export default DealTemperature; 