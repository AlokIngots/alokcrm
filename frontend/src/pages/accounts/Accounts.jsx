import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Table from '../../components/table/Table';
import AddAccountModal from './AddAccountModal';
import EditAccountModal from './EditAccountModal';
import ViewAccountModal from './ViewAccountModal';
import BlacklistConfirmationModal from './BlacklistConfirmationModal';
import { cellRenderers, createColumn } from '../../components/table/ColumnHelpers';
import { accountsApi } from './api/accounts';
import { formatIndianCurrency } from './utils/accountUtils';
import { getIndustryColors } from '../../config/industry-master';
import { getDivisionLabel } from '../../config/divisions';
import { useAccessControl, PermissionGuard } from '../../contexts/AccessControlContext';
import { NoSymbolIcon, ArrowUturnLeftIcon } from '@heroicons/react/24/outline';


const Accounts = () => {
  const [accounts, setAccounts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isBlacklistModalOpen, setIsBlacklistModalOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [isBlacklisting, setIsBlacklisting] = useState(false);

  // Get permissions from access control context
  const { canEditAccounts, canBlacklistAccounts } = useAccessControl();

  // Handle account actions
  const handleViewAccount = useCallback((account) => {
    setSelectedAccount(account);
    setIsViewModalOpen(true);
  }, []);

  const handleEditAccount = useCallback((account) => {
    setSelectedAccount(account);
    setIsEditModalOpen(true);
  }, []);

  const handleBlacklistAccount = useCallback((account) => {
    setSelectedAccount(account);
    setIsBlacklisting(!account.blacklist); 
    setIsBlacklistModalOpen(true);
  }, []);

  // Action buttons component
  const ActionButtons = useCallback(({ row }) => {
    const account = row.original;
    
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => handleViewAccount(account)}
          className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
          title="View account details"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        </button>
        {canEditAccounts && (
          <button
            onClick={() => handleEditAccount(account)}
            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Edit account"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        )}
        {canBlacklistAccounts && (
          <button
            onClick={() => handleBlacklistAccount(account)}
            className={`p-2 rounded-lg transition-colors ${
              account.blacklist 
                ? 'text-gray-400 hover:text-green-600 hover:bg-green-50' 
                : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
            }`}
            title={account.blacklist ? 'Remove from blacklist' : 'Blacklist account'}
          >
            {account.blacklist ? (
              <ArrowUturnLeftIcon className="w-4 h-4" />
            ) : (
              <NoSymbolIcon className="w-4 h-4" />
            )}
          </button>
        )}
      </div>
    );
  }, [handleViewAccount, handleEditAccount, handleBlacklistAccount, canEditAccounts, canBlacklistAccounts]);

  // Custom cell renderer for turnover
  const turnoverRenderer = (amount) => {
    if (!amount) return cellRenderers.textWithFallback(amount);
    
    // Format as currency if it's a number
    const numericAmount = parseFloat(amount);
    if (!isNaN(numericAmount)) {
      return formatIndianCurrency(numericAmount);
    }
    
    return cellRenderers.textWithFallback(amount);
  };

  // Custom cell renderer for industry with badge
  const industryRenderer = (industry) => {
    if (!industry) return cellRenderers.textWithFallback(industry);
    
    const industryColors = getIndustryColors();
    
    return cellRenderers.statusBadge(industry, industryColors);
  };

  // Define columns (only 5 columns as requested)
  const columns = useMemo(() => [
    createColumn('Name', 'Name', {
      cell: ({ getValue, row }) => {
        const account = row.original;
        const isBlacklisted = account.blacklist === 1;
        
        return (
          <div className="flex items-center">
            <div className="flex-shrink-0 h-8 w-8">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-sm font-medium">
                {getValue()?.charAt(0)?.toUpperCase() || '?'}
              </div>
            </div>
            <div className="ml-3">
              <div className="flex items-center">
                <div className="text-sm font-medium text-gray-900">{getValue()}</div>
                {isBlacklisted && (
                  <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
                    </svg>
                    Blacklisted
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      },
      filterFn: 'fuzzy',
    }),
    createColumn('Industry', 'Industry', {
      cell: ({ getValue }) => industryRenderer(getValue()),
      filterFn: 'fuzzy',
    }),
    createColumn('Division', 'Sale Type', {
      cell: ({ getValue }) => {
        const value = getValue();
        return cellRenderers.textWithFallback(value ? getDivisionLabel(value) : value);
      },
      filterFn: 'fuzzy',
    }),
    createColumn('Location', 'Location', {
      cell: ({ getValue }) => cellRenderers.textWithFallback(getValue()),
      filterFn: 'fuzzy',
    }),
    createColumn('Turnover', 'Turnover', {
      cell: ({ getValue }) => turnoverRenderer(getValue()),
      filterFn: 'fuzzy',
    }),
    {
      id: 'actions',
      header: 'Actions',
      cell: ActionButtons,
      enableSorting: false,
      enableColumnFilter: false,
    }
  ], [ActionButtons]);

  // Fetch accounts data
  const fetchAccounts = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const accountData = await accountsApi.getAllAccounts();
      setAccounts(accountData);
    } catch (err) {
      setError('Failed to fetch accounts data. Please try again later.');
      console.error('Error fetching accounts:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle account creation
  const handleAccountCreated = async (accountData) => {
    try {
      await accountsApi.createAccount(accountData);
      // Refresh the accounts list after successful creation
      await fetchAccounts();
    } catch (error) {
      // Re-throw the error so the modal can handle it
      throw error;
    }
  };

  // Handle account update
  const handleAccountUpdated = async (accountId, accountData) => {
    try {
      await accountsApi.updateAccount(accountId, accountData);
      await fetchAccounts();
    } catch (error) {
      throw error;
    }
  };

  // Handle blacklist toggle
  const handleBlacklistToggle = async (blacklistData) => {
    try {
      await accountsApi.toggleBlacklist(selectedAccount.id, blacklistData);
      await fetchAccounts();
      setError(null); 
    } catch (error) {
      setError(`Failed to ${isBlacklisting ? 'blacklist' : 'remove from blacklist'} account. Please try again.`);
      throw error;
    }
  };


  // Initial data fetch
  useEffect(() => {
    fetchAccounts();
  }, []);

  if (error && !accounts.length) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <span className="text-red-400 mr-2">⚠️</span>
            <div>
              <h3 className="text-red-800 font-medium">Error Loading Accounts</h3>
              <p className="text-red-600 text-sm mt-1">{error}</p>
            </div>
          </div>
          <button 
            onClick={fetchAccounts} 
            className="mt-3 bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded text-sm transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header with Add Button */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Accounts</h1>
              <p className="text-gray-600 mt-1">Manage your customer accounts portfolio</p>
            </div>
            <PermissionGuard resource="accounts" action="create">
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
              >
                <span className="mr-2">+</span>
                Add Account
              </button>
            </PermissionGuard>
          </div>
        </div>

        {/* Table */}
        <Table
          data={accounts}
          columns={columns}
          title="Accounts"
          icon="🏢"
          isLoading={isLoading}
          pageSize={10}
          enableGlobalFilter={true}
          enableColumnFilters={true}
          enableSorting={true}
          enablePagination={true}
        />

        {/* Modals */}
        <AddAccountModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onAccountAdded={handleAccountCreated}
        />

        <ViewAccountModal
          isOpen={isViewModalOpen}
          onClose={() => {
            setIsViewModalOpen(false);
            setSelectedAccount(null);
          }}
          account={selectedAccount}
        />

        <EditAccountModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedAccount(null);
          }}
          onAccountUpdated={handleAccountUpdated}
          account={selectedAccount}
        />

        <BlacklistConfirmationModal
          isOpen={isBlacklistModalOpen}
          onClose={() => {
            setIsBlacklistModalOpen(false);
            setSelectedAccount(null);
            setIsBlacklisting(false);
          }}
          onConfirm={handleBlacklistToggle}
          account={selectedAccount}
          isBlacklisting={isBlacklisting}
        />

        
      </div>
    </div>
  );
};

export default Accounts;
