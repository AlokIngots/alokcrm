import React from 'react';
import { useAccessControl } from '../../../contexts/AccessControlContext';

const PipelineHeader = ({ 
  isLoading = false, 
  isUpdating = false, 
  error = null, 
  onRefresh = () => {},
  onClearError = () => {},
  onReassignDeals = () => {},
  searchTerm = '',
  onSearchChange = () => {},
  onClearSearch = () => {},
  totalDeals = 0,
  filteredDeals = 0
}) => {
  // Get permissions from access control context
  const { canReassignDeals } = useAccessControl();

  const handleSearchInput = (e) => {
    onSearchChange(e.target.value);
  };

  return (
    <div className="bg-white border-b border-gray-200 p-6 shadow-sm w-full">
      <div className="flex items-center justify-between min-w-0 max-w-full gap-4">
        {/* Left side - Title */}
        <div className="flex-shrink-0 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900">Sales Pipeline (Offers)</h1>
          <p className="text-gray-600 mt-1">
            Drag and drop deals to update their stage
            {searchTerm && (
              <span className="ml-2 text-sm">
                • Showing {filteredDeals} of {totalDeals} deals
              </span>
            )}
          </p>
        </div>

        {/* Center - Search Bar */}
        <div className="flex-1 max-w-lg mx-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={handleSearchInput}
              placeholder="Search deals..."
              className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
            {searchTerm && (
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                <button
                  onClick={onClearSearch}
                  className="text-gray-400 hover:text-gray-600 focus:outline-none"
                  title="Clear search"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right side - Action buttons */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {isUpdating && (
            <div className="flex items-center text-blue-600">
              <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle>
                <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75"></path>
              </svg>
              <span className="text-sm whitespace-nowrap">Updating...</span>
            </div>
          )}
          
          {/* Reassign Deals Button - Only visible to users with reassign permission */}
          {canReassignDeals && (
            <button
              onClick={onReassignDeals}
              disabled={isLoading}
              className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center whitespace-nowrap"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              Reassign
            </button>
          )}
          
          <button 
            onClick={onRefresh}
            disabled={isLoading || isUpdating}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {isLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Search Results Info - Only show when there's a search term */}
      {searchTerm && (
        <div className="mt-3 text-sm text-gray-600">
          {filteredDeals === 0 ? (
            <span className="text-orange-600">No deals found matching "{searchTerm}"</span>
          ) : (
            <span>
              Found {filteredDeals} deal{filteredDeals !== 1 ? 's' : ''} matching "{searchTerm}"
              {filteredDeals !== totalDeals && (
                <button
                  onClick={onClearSearch}
                  className="ml-2 text-blue-600 hover:text-blue-800 underline"
                >
                  Show all {totalDeals} deals
                </button>
              )}
            </span>
          )}
        </div>
      )}

      {/* Error banner for failed updates */}
      {error && (
        <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center min-w-0">
              <svg className="w-4 h-4 text-yellow-400 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 18.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <span className="text-yellow-800 text-sm truncate">{error}</span>
            </div>
            <button
              onClick={onClearError}
              className="text-yellow-600 hover:text-yellow-800 text-sm font-medium flex-shrink-0 ml-2"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(PipelineHeader);
