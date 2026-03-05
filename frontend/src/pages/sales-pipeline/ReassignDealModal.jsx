import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { pipelineApi as dealsApi } from '../../modules/pipeline/api/pipelineApi';
import { usersApi } from '../users/api/users';
import { formatIndianCurrency, formatDate } from './utils/formatters';
import { getDivisionConfig, getDivisionLabel } from '../../config/divisions';

import { filterSalespeople } from '../../config/access-control';


const ReassignDealModal = ({ isOpen, onClose, onReassignSuccess }) => {
  const [salespeople, setSalespeople] = useState([]);
  const [selectedFromSalesperson, setSelectedFromSalesperson] = useState('');
  const [selectedToSalesperson, setSelectedToSalesperson] = useState('');
  const [deals, setDeals] = useState([]);
  const [selectedDeals, setSelectedDeals] = useState(new Set());
  const [isLoadingSalespeople, setIsLoadingSalespeople] = useState(false);
  const [isLoadingDeals, setIsLoadingDeals] = useState(false);
  const [isReassigning, setIsReassigning] = useState(false);
  const [error, setError] = useState(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      fetchSalespeople();
      setSelectedFromSalesperson('');
      setSelectedToSalesperson('');
      setDeals([]);
      setSelectedDeals(new Set());
      setError(null);
    }
  }, [isOpen]);

  // Fetch deals when "from" salesperson changes
  useEffect(() => {
    if (selectedFromSalesperson) {
      fetchDealsForSalesperson(selectedFromSalesperson);
    } else {
      setDeals([]);
      setSelectedDeals(new Set());
    }
  }, [selectedFromSalesperson]);


  const fetchSalespeople = async () => {
    try {
      setIsLoadingSalespeople(true);
      setError(null);
      const users = await usersApi.getAllUsers();
      // Filter to show only salespeople using the access control config
      const salespeopleOnly = filterSalespeople(users);
      setSalespeople(salespeopleOnly);
    } catch (err) {
      console.error('Error fetching salespeople:', err);
      setError('Failed to load salespeople');
    } finally {
      setIsLoadingSalespeople(false);
    }
  };

  const fetchDealsForSalesperson = async (ecode) => {
    try {
      setIsLoadingDeals(true);
      setError(null);
      const salespersonDeals = await dealsApi.getDealsBySalesperson(ecode);
      setDeals(salespersonDeals);
      setSelectedDeals(new Set());
    } catch (err) {
      console.error('Error fetching deals for salesperson:', err);
      setError('Failed to load deals for selected salesperson');
      setDeals([]);
    } finally {
      setIsLoadingDeals(false);
    }
  };

  const handleDealSelection = useCallback((dealId) => {
    setSelectedDeals(prev => {
      const newSet = new Set(prev);
      if (newSet.has(dealId)) {
        newSet.delete(dealId);
      } else {
        newSet.add(dealId);
      }
      return newSet;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedDeals(prev => {
      if (prev.size === deals.length) {
        return new Set(); // Deselect all
      } else {
        return new Set(deals.map(deal => deal.ID)); // Select all
      }
    });
  }, [deals]);

  const handleReassign = async () => {
    if (selectedDeals.size === 0 || !selectedToSalesperson) {
      setError('Please select deals and a target salesperson');
      return;
    }

    if (selectedFromSalesperson === selectedToSalesperson) {
      setError('Cannot reassign deals to the same salesperson');
      return;
    }

    try {
      setIsReassigning(true);
      setError(null);
      
      const result = await dealsApi.reassignDeals(
        Array.from(selectedDeals), 
        selectedToSalesperson
      );

      onReassignSuccess?.(result);
      onClose();
    } catch (err) {
      console.error('Error reassigning deals:', err);
      setError(err.message || 'Failed to reassign deals');
    } finally {
      setIsReassigning(false);
    }
  };

  const selectedFromSalespersonName = useMemo(() => {
    const salesperson = salespeople.find(sp => sp.ECode === selectedFromSalesperson);
    return salesperson ? salesperson.Name : '';
  }, [salespeople, selectedFromSalesperson]);

  const selectedToSalespersonName = useMemo(() => {
    const salesperson = salespeople.find(sp => sp.ECode === selectedToSalesperson);
    return salesperson ? salesperson.Name : '';
  }, [salespeople, selectedToSalesperson]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Reassign Deals</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-red-800 text-sm">{error}</span>
              </div>
            </div>
          )}

          {/* From Salesperson Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              From Salesperson
            </label>
            <select
              value={selectedFromSalesperson}
              onChange={(e) => setSelectedFromSalesperson(e.target.value)}
              disabled={isLoadingSalespeople}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
            >
              <option value="">Select a salesperson to view their deals</option>
              {salespeople.map(salesperson => (
                <option key={salesperson.ECode} value={salesperson.ECode}>
                  {salesperson.Name} ({salesperson.ECode})
                </option>
              ))}
            </select>
            {isLoadingSalespeople && (
              <div className="text-sm text-gray-500 mt-1">Loading salespeople...</div>
            )}
          </div>

          {/* Deals Table */}
          {selectedFromSalesperson && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Deals for {selectedFromSalespersonName}
                </h3>
                {deals.length > 0 && (
                  <button
                    onClick={handleSelectAll}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    {selectedDeals.size === deals.length ? 'Deselect All' : 'Select All'}
                  </button>
                )}
              </div>

              {isLoadingDeals ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-2 text-gray-600">Loading deals...</span>
                </div>
              ) : deals.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                  <p>No deals found for this salesperson.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          <input
                            type="checkbox"
                            checked={selectedDeals.size === deals.length && deals.length > 0}
                            onChange={handleSelectAll}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Account Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Contact Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Division
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Service Type
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Estimated Annual Deal Value
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Expected Closure Date
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {deals.map((deal) => {
                        const divisionConfig = getDivisionConfig(deal.Division);
                        return (
                          <tr 
                            key={deal.ID}
                            className={`hover:bg-gray-50 ${selectedDeals.has(deal.ID) ? 'bg-blue-50' : ''}`}
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <input
                                type="checkbox"
                                checked={selectedDeals.has(deal.ID)}
                                onChange={() => handleDealSelection(deal.ID)}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">{deal.AccountName}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">{deal.ContactName || 'N/A'}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${divisionConfig.badgeColor}`}>
                                {getDivisionLabel(deal.Division)}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">{deal.ServiceType}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-semibold text-green-600">
                                {formatIndianCurrency(deal.DealValue)}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                {formatDate(deal.ExpectedClosureDate)}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* To Salesperson Selection */}
          {selectedDeals.size > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                To Salesperson
              </label>
              <select
                value={selectedToSalesperson}
                onChange={(e) => setSelectedToSalesperson(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select target salesperson</option>
                {salespeople
                  .filter(sp => sp.ECode !== selectedFromSalesperson)
                  .map(salesperson => (
                    <option key={salesperson.ECode} value={salesperson.ECode}>
                      {salesperson.Name} ({salesperson.ECode})
                    </option>
                  ))}
              </select>
            </div>
          )}

          {/* Reassignment Summary */}
          {selectedDeals.size > 0 && selectedToSalesperson && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">Reassignment Summary</h4>
              <p className="text-sm text-blue-800">
                Reassigning <strong>{selectedDeals.size}</strong> deal{selectedDeals.size > 1 ? 's' : ''} from <strong>{selectedFromSalespersonName}</strong> to <strong>{selectedToSalespersonName}</strong>
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            disabled={isReassigning}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleReassign}
            disabled={selectedDeals.size === 0 || !selectedToSalesperson || isReassigning}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {isReassigning ? (
              <>
                <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle>
                  <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75"></path>
                </svg>
                Reassigning...
              </>
            ) : (
              `Reassign ${selectedDeals.size} Deal${selectedDeals.size > 1 ? 's' : ''}`
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReassignDealModal; 
