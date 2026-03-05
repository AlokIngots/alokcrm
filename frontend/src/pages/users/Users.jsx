import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Table from '../../components/table/Table';
import AddUserModal from './AddUserModal';
import EditUserModal from './EditUserModal';
import ViewUserModal from './ViewUserModal';
import { cellRenderers, createColumn } from '../../components/table/ColumnHelpers';
import { usersApi } from './api/users';
import { userManager } from '../login/api/auth';

const Users = () => {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  const currentUser = userManager.getUser();
  const role = (currentUser?.Role || '').trim();
  const isAdminUser = ['MD Office', 'Admin', 'Super Admin'].includes(role);

  // Handle user actions
  const handleEditUser = useCallback((user) => {
    setSelectedUser(user);
    setIsEditModalOpen(true);
  }, []);

  const handleViewUser = useCallback((user) => {
    setSelectedUser(user);
    setIsViewModalOpen(true);
  }, []);

  // Action buttons component - now with view and edit only
  const ActionButtons = useCallback(({ row }) => {
    const user = row.original;
    
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => handleViewUser(user)}
          className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
          title="View user details"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        </button>
        {isAdminUser && (
          <button
            onClick={() => handleEditUser(user)}
            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Edit user"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        )}
      </div>
    );
  }, [handleViewUser, handleEditUser, isAdminUser]);

  // Define columns using the helper functions
  const columns = useMemo(() => [
    createColumn('ECode', 'Employee Code', {
      filterFn: 'fuzzy',
    }),
    createColumn('Name', 'Name', {
      cell: ({ getValue }) => cellRenderers.avatarWithName(getValue()),
      filterFn: 'fuzzy',
    }),
    createColumn('Role', 'Role', {
      cell: ({ getValue }) => cellRenderers.roleBadge(getValue()),
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

  // Fetch users data
  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const userData = await usersApi.getAllUsers();
      setUsers(userData);
    } catch (err) {
      setError('Failed to fetch users data. Please try again later.');
      console.error('Error fetching users:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle user creation
  const handleUserCreated = async (userData) => {
    try {
      await usersApi.createUser(userData);
      // Refresh the users list after successful creation
      await fetchUsers();
    } catch (error) {
      // Re-throw the error so the modal can handle it
      throw error;
    }
  };

  // Handle user update
  const handleUserUpdated = async (ecode, userData) => {
    try {
      await usersApi.updateUser(ecode, userData);
      // Refresh the users list after successful update
      await fetchUsers();
    } catch (error) {
      // Re-throw the error so the modal can handle it
      throw error;
    }
  };


  // Initial data fetch
  useEffect(() => {
    fetchUsers();
  }, []);

  if (error && !users.length) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <span className="text-red-400 mr-2">⚠️</span>
            <div>
              <h3 className="text-red-800 font-medium">Error Loading Users</h3>
              <p className="text-red-600 text-sm mt-1">{error}</p>
            </div>
          </div>
          <button 
            onClick={fetchUsers} 
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
              <h1 className="text-2xl font-bold text-gray-900">Team</h1>
              <p className="text-gray-600 mt-1">Manage your team members</p>
            </div>
            {isAdminUser && (
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
              >
                <span className="mr-2">+</span>
                Add Member
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <Table
          data={users}
          columns={columns}
          title="Team"
          icon="👥"
          isLoading={isLoading}
          pageSize={10}
          enableGlobalFilter={true}
          enableColumnFilters={true}
          enableSorting={true}
          enablePagination={true}
        />

        {/* Modals */}
        <AddUserModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onUserAdded={handleUserCreated}
          users={users}
        />

        <EditUserModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedUser(null);
          }}
          onUserUpdated={handleUserUpdated}
          user={selectedUser}
          users={users}
        />

        <ViewUserModal
          isOpen={isViewModalOpen}
          onClose={() => {
            setIsViewModalOpen(false);
            setSelectedUser(null);
          }}
          user={selectedUser}
        />
      </div>
    </div>
  );
};

export default Users;
