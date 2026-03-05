import React, { useState, useEffect, useMemo } from 'react';
import { accountsApi } from '../accounts/api/accounts';
import { usersApi } from '../users/api/users';
import { targetsApi } from './api/targets';
import { filterSalespeople } from '../../config/access-control';

const SetTargets = () => {
  const [selectedSalesperson, setSelectedSalesperson] = useState('');
  const [selectedAccounts, setSelectedAccounts] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [salespeople, setSalespeople] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState(null);
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Upload functionality states
  const [selectedUploadSalesperson, setSelectedUploadSalesperson] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);

  // Fetch initial data when component mounts
  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [accountsData, usersData] = await Promise.all([
        accountsApi.getAllAccounts(),
        usersApi.getAllUsers()
      ]);

      setAccounts(Array.isArray(accountsData) ? accountsData : []);
      // Filter users to show only salespeople
      const salespeople = filterSalespeople(Array.isArray(usersData) ? usersData : []);
      setSalespeople(salespeople);
    } catch (err) {
      setError('Failed to load data. Please try again.');
      console.error('Error fetching initial data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Get selected account details for display
  const selectedAccountsDetails = useMemo(() => {
    return accounts.filter(account => selectedAccounts.includes(account.id));
  }, [accounts, selectedAccounts]);

  // Filter accounts based on search query
  const filteredAccounts = useMemo(() => {
    if (!searchQuery.trim()) {
      return accounts;
    }
    
    return accounts.filter(account => {
      const searchTerm = searchQuery.toLowerCase();
      const accountName = account.Name?.toLowerCase() || '';
      const division = account.Division?.toLowerCase() || '';
      const location = account.Location?.toLowerCase() || '';
      
      return accountName.includes(searchTerm) || 
             division.includes(searchTerm) || 
             location.includes(searchTerm);
    });
  }, [accounts, searchQuery]);

  const handleSalespersonChange = (e) => {
    setSelectedSalesperson(e.target.value);
    setError(null);
  };

  const handleUploadSalespersonChange = (e) => {
    setSelectedUploadSalesperson(e.target.value);
    setError(null);
    setUploadResult(null);
  };

  const handleAccountToggle = (accountId) => {
    setSelectedAccounts(prev => {
      if (prev.includes(accountId)) {
        return prev.filter(id => id !== accountId);
      } else {
        return [...prev, accountId];
      }
    });
    setError(null);
  };

  const handleSelectAllAccounts = () => {
    if (selectedAccounts.length === filteredAccounts.length) {
      // If all filtered accounts are selected, deselect only the filtered ones
      const filteredAccountIds = filteredAccounts.map(account => account.id);
      setSelectedAccounts(prev => prev.filter(id => !filteredAccountIds.includes(id)));
    } else {
      // Select all filtered accounts (add to existing selection)
      const filteredAccountIds = filteredAccounts.map(account => account.id);
      setSelectedAccounts(prev => {
        const newSelection = [...prev];
        filteredAccountIds.forEach(id => {
          if (!newSelection.includes(id)) {
            newSelection.push(id);
          }
        });
        return newSelection;
      });
    }
  };

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  const handleDropdownToggle = () => {
    setShowAccountDropdown(!showAccountDropdown);
    // Clear search when closing dropdown
    if (showAccountDropdown) {
      setSearchQuery('');
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setSelectedFile(file);
    setError(null);
    setUploadResult(null);
  };

  const handleDownloadTemplate = async () => {
    if (!selectedSalesperson) {
      setError('Please select a salesperson');
      return;
    }

    if (selectedAccounts.length === 0) {
      setError('Please select at least one account');
      return;
    }

    setIsDownloading(true);
    setError(null);

    try {
      const requestData = {
        account_ids: selectedAccounts,
        ecode: selectedSalesperson
      };

      const blob = await targetsApi.downloadTemplate(requestData);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Get salesperson name for filename
      const salesperson = salespeople.find(sp => sp.ECode === selectedSalesperson);
      const salespersonName = salesperson ? salesperson.Name.replace(' ', '_') : selectedSalesperson;
      
      link.download = `targets_template_${salespersonName}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || 'Failed to download template. Please try again.');
      console.error('Error downloading template:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleUploadTemplate = async () => {
    if (!selectedUploadSalesperson) {
      setError('Please select a salesperson for upload');
      return;
    }

    if (!selectedFile) {
      setError('Please select a file to upload');
      return;
    }

    // Validate file type
    if (!selectedFile.name.toLowerCase().endsWith('.xlsx') && !selectedFile.name.toLowerCase().endsWith('.xls')) {
      setError('Please select an Excel file (.xlsx or .xls)');
      return;
    }

    setIsUploading(true);
    setError(null);
    setUploadResult(null);

    try {
      const result = await targetsApi.uploadTemplate(selectedFile, selectedUploadSalesperson);
      setUploadResult(result);
      
      // Clear the form on successful upload
      setSelectedFile(null);
      const fileInput = document.getElementById('file-upload');
      if (fileInput) {
        fileInput.value = '';
      }
    } catch (err) {
      setError(err.message || 'Failed to upload template. Please try again.');
      console.error('Error uploading template:', err);
    } finally {
      setIsUploading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex items-center">
            <svg className="animate-spin h-8 w-8 text-blue-600 mr-3" fill="none" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle>
              <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75"></path>
            </svg>
            <span className="text-gray-600 text-lg">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Set Targets</h1>
        <p className="text-gray-600 mt-1">Generate and upload targets template for salespeople</p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-red-800">{error}</span>
          </div>
        </div>
      )}

      {/* Upload Result Display */}
      {uploadResult && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-green-400 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <h3 className="text-green-800 font-medium">{uploadResult.message}</h3>
              <p className="text-green-700 text-sm mt-1">
                Processed {uploadResult.total_records} records, {uploadResult.success_count} successful updates
              </p>
              {uploadResult.errors && uploadResult.errors.length > 0 && (
                <div className="mt-3">
                  <p className="text-red-700 text-sm font-medium">Errors encountered:</p>
                  <ul className="text-red-600 text-xs mt-1 ml-4 list-disc max-h-32 overflow-y-auto">
                    {uploadResult.errors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Download Template Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Download Template</h2>
            <p className="text-gray-600 text-sm mt-1">Generate a targets template for a salesperson</p>
          </div>
          
          <div className="space-y-4">
            {/* Salesperson Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Salesperson <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedSalesperson}
                onChange={handleSalespersonChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select a salesperson</option>
                {salespeople.map(user => (
                  <option key={user.ECode} value={user.ECode}>
                    {user.Name} ({user.ECode})
                  </option>
                ))}
              </select>
            </div>

            {/* Accounts Multi-Select */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Accounts <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={handleDropdownToggle}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-left bg-white flex items-center justify-between"
                >
                  <span className="text-gray-700">
                    {selectedAccounts.length === 0
                      ? 'Select accounts'
                      : `${selectedAccounts.length} account${selectedAccounts.length === 1 ? '' : 's'} selected`
                    }
                  </span>
                  <svg
                    className={`w-5 h-5 text-gray-400 transition-transform ${showAccountDropdown ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showAccountDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-80 overflow-hidden flex flex-col">
                    {/* Search Input */}
                    <div className="p-3 border-b border-gray-100">
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Search accounts..."
                          value={searchQuery}
                          onChange={handleSearchChange}
                          className="w-full px-3 py-2 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          autoFocus
                        />
                        <svg
                          className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                    </div>

                    {/* Scrollable content */}
                    <div className="overflow-y-auto flex-1">
                      {/* Select All Option */}
                      <div
                        onClick={handleSelectAllAccounts}
                        className="px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 flex items-center"
                      >
                        <input
                          type="checkbox"
                          checked={filteredAccounts.length > 0 && filteredAccounts.every(account => selectedAccounts.includes(account.id))}
                          onChange={() => {}} // Handled by onClick
                          className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="font-medium text-gray-700">
                          Select All {searchQuery ? `(${filteredAccounts.length} filtered)` : `(${accounts.length})`}
                        </span>
                      </div>

                      {/* Account Options */}
                      {filteredAccounts.length === 0 ? (
                        <div className="px-3 py-4 text-center text-gray-500 text-sm">
                          {searchQuery ? 'No accounts found matching your search' : 'No accounts available'}
                        </div>
                      ) : (
                        filteredAccounts.map(account => (
                          <div
                            key={account.id}
                            onClick={() => handleAccountToggle(account.id)}
                            className="px-3 py-2 hover:bg-gray-50 cursor-pointer flex items-center"
                          >
                            <input
                              type="checkbox"
                              checked={selectedAccounts.includes(account.id)}
                              onChange={() => {}} // Handled by onClick
                              className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <span className="text-gray-700 text-sm">
                              {account.Name}
                              {account.Division && ` - ${account.Division}`}
                              {account.Location && ` - ${account.Location}`}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Selected Accounts Display */}
              {selectedAccounts.length > 0 && (
                <div className="mt-3">
                  <div className="text-xs text-gray-500 mb-2">Selected accounts:</div>
                  <div className="flex flex-wrap gap-2">
                    {selectedAccountsDetails.map(account => (
                      <span
                        key={account.id}
                        className="inline-flex items-center px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-md"
                      >
                        {account.Name}
                        <button
                          onClick={() => handleAccountToggle(account.id)}
                          className="ml-1 text-blue-600 hover:text-blue-800"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Download Button */}
            <div>
              <button
                onClick={handleDownloadTemplate}
                disabled={isDownloading || !selectedSalesperson || selectedAccounts.length === 0}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {isDownloading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle>
                      <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75"></path>
                    </svg>
                    Downloading...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Download Template
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Upload Template Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Upload Template</h2>
            <p className="text-gray-600 text-sm mt-1">Upload a completed targets template</p>
          </div>
          
          <div className="space-y-4">
            {/* Upload Salesperson Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Salesperson <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedUploadSalesperson}
                onChange={handleUploadSalespersonChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select a salesperson</option>
                {salespeople.map(user => (
                  <option key={user.ECode} value={user.ECode}>
                    {user.Name} ({user.ECode})
                  </option>
                ))}
              </select>
            </div>

            {/* File Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Excel File <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="file"
                  id="file-upload"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent file:mr-4 file:py-1 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                {selectedFile && (
                  <div className="mt-2 text-sm text-gray-600">
                    Selected: {selectedFile.name}
                  </div>
                )}
              </div>
            </div>

            {/* Upload Button */}
            <div>
              <button
                onClick={handleUploadTemplate}
                disabled={isUploading || !selectedUploadSalesperson || !selectedFile}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {isUploading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle>
                      <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75"></path>
                    </svg>
                    Uploading...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    Upload File
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Click outside handler for dropdown */}
      {showAccountDropdown && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setShowAccountDropdown(false)}
        />
      )}
    </div>
  );
};

export default SetTargets;
