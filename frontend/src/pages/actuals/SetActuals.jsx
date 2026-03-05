import React, { useState, useEffect, useCallback } from 'react';
import { actualsApi } from './api/actuals';

const SetActuals = () => {
  const [financialYears, setFinancialYears] = useState([]);
  const [selectedFY, setSelectedFY] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState('');

  // Upload functionality states
  const [selectedUploadFY, setSelectedUploadFY] = useState('');
  const [selectedUploadMonth, setSelectedUploadMonth] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);

  const months = [
    'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
    'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'
  ];

  // Fetch financial years on component mount
  useEffect(() => {
    const fetchFinancialYears = async () => {
      setIsLoading(true);
      setError('');
      try {
        const years = await actualsApi.getFinancialYears();
        setFinancialYears(years);
        
        // Auto-select the first available year if any
        if (years.length > 0) {
          setSelectedFY(years[0]);
        }
      } catch (error) {
        console.error('Error fetching financial years:', error);
        setError('Failed to load financial years. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchFinancialYears();
  }, []);

  // Handle download template
  const handleDownloadTemplate = useCallback(async () => {
    if (!selectedFY || !selectedMonth) {
      setError('Please select both Financial Year and Month');
      return;
    }

    setIsDownloading(true);
    setError('');

    try {
      const blob = await actualsApi.downloadTemplate(selectedFY, selectedMonth);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `actuals_template_${selectedFY}_${selectedMonth}.xlsx`;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Error downloading template:', error);
      setError('Failed to download template. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  }, [selectedFY, selectedMonth]);

  // Handle file change
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setSelectedFile(file);
    setError('');
    setUploadResult(null);
  };

  // Handle upload template
  const handleUploadTemplate = useCallback(async () => {
    if (!selectedUploadFY) {
      setError('Please select Financial Year for upload');
      return;
    }

    if (!selectedUploadMonth) {
      setError('Please select Month for upload');
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
    setError('');
    setUploadResult(null);

    try {
      const result = await actualsApi.uploadTemplate(selectedFile, selectedUploadFY, selectedUploadMonth);
      setUploadResult(result);
      
      // Clear the form on successful upload
      setSelectedFile(null);
      const fileInput = document.getElementById('actuals-file-upload');
      if (fileInput) {
        fileInput.value = '';
      }
    } catch (error) {
      console.error('Error uploading template:', error);
      setError(error.message || 'Failed to upload template. Please try again.');
    } finally {
      setIsUploading(false);
    }
  }, [selectedUploadFY, selectedUploadMonth, selectedFile]);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Report Actuals</h1>
        <p className="text-gray-600 mt-1">Generate and upload actuals template for reporting actual sales figures</p>
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
            <p className="text-gray-600 text-sm mt-1">Generate an actuals template for specified period</p>
          </div>
          
          <div className="space-y-4">
            {/* Financial Year Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Financial Year <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedFY}
                onChange={(e) => setSelectedFY(e.target.value)}
                disabled={isLoading}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">
                  {isLoading ? 'Loading...' : 'Select Financial Year'}
                </option>
                {financialYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            {/* Month Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Month <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select Month</option>
                {months.map((month) => (
                  <option key={month} value={month}>
                    {month}
                  </option>
                ))}
              </select>
            </div>

            {/* Download Button */}
            <div>
              <button
                onClick={handleDownloadTemplate}
                disabled={isDownloading || !selectedFY || !selectedMonth}
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
            <p className="text-gray-600 text-sm mt-1">Upload a completed actuals template</p>
          </div>
          
          <div className="space-y-4">
            {/* Upload Financial Year Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Financial Year <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedUploadFY}
                onChange={(e) => {
                  setSelectedUploadFY(e.target.value);
                  setError('');
                  setUploadResult(null);
                }}
                disabled={isLoading}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">
                  {isLoading ? 'Loading...' : 'Select Financial Year'}
                </option>
                {financialYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            {/* Upload Month Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Month <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedUploadMonth}
                onChange={(e) => {
                  setSelectedUploadMonth(e.target.value);
                  setError('');
                  setUploadResult(null);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select Month</option>
                {months.map((month) => (
                  <option key={month} value={month}>
                    {month}
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
                  id="actuals-file-upload"
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
                disabled={isUploading || !selectedUploadFY || !selectedUploadMonth || !selectedFile}
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
    </div>
  );
};

export default SetActuals;
