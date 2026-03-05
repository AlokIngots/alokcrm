import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Table from '../../components/table/Table';
import AddContactModal from './AddContactModal';
import EditContactModal from './EditContactModal';
import ViewContactModal from './ViewContactModal';
import { cellRenderers, createColumn } from '../../components/table/ColumnHelpers';
import { contactsApi } from './api/contacts';
import { accountsApi } from '../accounts/api/accounts';
import { getDivisionLabel } from '../../config/divisions';
import { useAccessControl, PermissionGuard } from '../../contexts/AccessControlContext';

const Contacts = () => {
  const [contacts, setContacts] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState(null);

  // Get permissions from access control context
  const { canEditContacts } = useAccessControl();

  // Handle contact actions
  const handleViewContact = useCallback((contact) => {
    setSelectedContact(contact);
    setIsViewModalOpen(true);
  }, []);

  const handleEditContact = useCallback((contact) => {
    setSelectedContact(contact);
    setIsEditModalOpen(true);
  }, []);


  // Action buttons component
  const ActionButtons = useCallback(({ row }) => {
    const contact = row.original;
    
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => handleViewContact(contact)}
          className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
          title="View contact details"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        </button>
        {canEditContacts && (
          <button
            onClick={() => handleEditContact(contact)}
            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Edit contact"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        )}
   
      </div>
    );
  }, [handleViewContact, handleEditContact, canEditContacts]);

  // Custom cell renderer for email with mailto link
  const emailRenderer = (email) => {
    if (!email) return cellRenderers.textWithFallback(email);
    
    return (
      <a
        href={`mailto:${email}`}
        className="text-blue-600 hover:text-blue-800 hover:underline transition-colors"
        title={`Send email to ${email}`}
      >
        {email}
      </a>
    );
  };



  // Define columns (showing Name, Account, Designation, Email1)
  const columns = useMemo(() => [
    createColumn('Name', 'Name', {

      cell: ({ getValue }) => (
        <div className="flex items-center">
          <div className="flex-shrink-0 h-8 w-8">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center text-white text-sm font-medium">
              {getValue()?.charAt(0)?.toUpperCase() || '?'}
            </div>
          </div>
          <div className="ml-3">
            <div className="text-sm font-medium text-gray-900">{getValue()}</div>
          </div>
        </div>
      ),
      filterFn: 'fuzzy',
    }),
    createColumn('Account', 'Account', {
      cell: ({ row }) => {
        const contact = row.original;
        // Try to find the full account information
        const account = accounts.find(acc => 
          acc.id === contact.AccountID
        );
        
        if (account) {
          const parts = [account.Name];
          if (account.Division) parts.push(getDivisionLabel(account.Division));
          if (account.Location) parts.push(account.Location);
          return cellRenderers.textWithFallback(parts.join(' - '));
        }
        
        return cellRenderers.textWithFallback(contact.Company || contact.Account);
      },
      filterFn: 'fuzzy',
    }),

    createColumn('Designation', 'Designation', {
      cell: ({ getValue }) => cellRenderers.textWithFallback(getValue()),
      filterFn: 'fuzzy',
    }),
    createColumn('Email1', 'Email', {
      cell: ({ getValue }) => emailRenderer(getValue()),
      filterFn: 'fuzzy',
    }),
    {
      id: 'actions',
      header: 'Actions',
      cell: ActionButtons,
      enableSorting: false,
      enableColumnFilter: false,
    }
  ], [ActionButtons, accounts]);

  // Fetch accounts data
  const fetchAccounts = async () => {
    try {
      const accountData = await accountsApi.getAllAccounts();
      setAccounts(accountData);
    } catch (err) {
      console.error('Error fetching accounts:', err);
    }
  };

  // Fetch contacts data
  const fetchContacts = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const contactData = await contactsApi.getAllContacts();
      setContacts(contactData);
    } catch (err) {
      setError('Failed to fetch contacts data. Please try again later.');
      console.error('Error fetching contacts:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle contact creation
  const handleContactCreated = async (contactData) => {
    try {
      await contactsApi.createContact(contactData);
      await fetchContacts(); // Refresh the data
    } catch (error) {
      throw error;
    }
  };

  // Handle contact update
  const handleContactUpdated = async (contactId, contactData) => {
    try {
      await contactsApi.updateContact(contactId, contactData);
      await fetchContacts(); // Refresh the data
    } catch (error) {
      throw error;
    }
  };


  // Initial data fetch
  useEffect(() => {
    fetchContacts();
    fetchAccounts();
  }, []);

  if (error && !contacts.length) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <span className="text-red-400 mr-2">⚠️</span>
            <div>
              <h3 className="text-red-800 font-medium">Error Loading Contacts</h3>
              <p className="text-red-600 text-sm mt-1">{error}</p>
            </div>
          </div>
          <button 
            onClick={fetchContacts} 
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
              <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
              <p className="text-gray-600 mt-1">Manage your business contacts</p>
            </div>
            <PermissionGuard resource="contacts" action="create">
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
              >
                <span className="mr-2">+</span>
                Add Contact
              </button>
            </PermissionGuard>
          </div>
        </div>

        {/* Table */}
        <Table
          data={contacts}
          columns={columns}
          title="Contacts"
          icon="👤"
          isLoading={isLoading}
          pageSize={10}
          enableGlobalFilter={true}
          enableColumnFilters={true}
          enableSorting={true}
          enablePagination={true}
        />

        {/* Modals */}
        <AddContactModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onContactAdded={handleContactCreated}
          accounts={accounts}
        />

        <EditContactModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedContact(null);
          }}
          onContactUpdated={handleContactUpdated}
          contact={selectedContact}
          accounts={accounts}
        />


        <ViewContactModal
          isOpen={isViewModalOpen}
          onClose={() => {
            setIsViewModalOpen(false);
            setSelectedContact(null);
          }}
          contact={selectedContact}
        />
      </div>
    </div>
  );
};

export default Contacts;
