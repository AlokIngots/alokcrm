import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Enquiries from './Enquiries';

jest.mock('../accounts/api/accounts', () => ({
  accountsApi: {
    getAllAccounts: jest.fn(),
    createAccount: jest.fn(),
  },
}));

jest.mock('../contacts/api/contacts', () => ({
  contactsApi: {
    getContactsByAccountId: jest.fn(),
    createContact: jest.fn(),
  },
}));

jest.mock('../../modules/pipeline/api/pipelineApi', () => ({
  pipelineApi: {
    createDeal: jest.fn(),
  },
}));

jest.mock('../login/api/auth', () => ({
  userManager: {
    getUser: jest.fn(),
  },
}));

const { accountsApi } = require('../accounts/api/accounts');
const { contactsApi } = require('../contacts/api/contacts');
const { pipelineApi: dealsApi } = require('../../modules/pipeline/api/pipelineApi');
const { userManager } = require('../login/api/auth');

describe('Enquiries form workflow', () => {
  beforeEach(() => {
    localStorage.setItem('access_token', 'test-token');
    userManager.getUser.mockReturnValue({ ECode: 'EMP001', Name: 'Alice Johnson' });
    accountsApi.getAllAccounts.mockResolvedValue([{ id: 1, Name: 'ALPHA LEVEL PVT LTD' }]);
    contactsApi.getContactsByAccountId.mockResolvedValue([{ id: 2, Name: 'Purchase Team' }]);
    dealsApi.createDeal.mockResolvedValue({ ID: 11 });

    global.fetch = jest.fn((url) => {
      if (String(url).includes('/api/v1/enquiries/masters/grades')) {
        return Promise.resolve({
          ok: true,
          json: async () => [{ code: '304L', name: 'Stainless Steel 304L' }],
        });
      }
      if (String(url).includes('/api/v1/enquiries/masters/tolerances')) {
        return Promise.resolve({
          ok: true,
          json: async () => [{ class_code: 'h9' }],
        });
      }
      if (String(url).includes('/api/v1/enquiries/')) {
        return Promise.resolve({
          ok: true,
          json: async () => [],
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
  });

  test('shows validation error when required fields are missing', async () => {
    render(<Enquiries />);

    userEvent.click(screen.getByRole('button', { name: 'New Enquiry' }));
    userEvent.click(screen.getByRole('button', { name: 'Save Enquiry' }));

    const errors = await screen.findAllByText('Customer Name is required.');
    expect(errors.length).toBeGreaterThan(0);
  });

  test('creates enquiry and syncs to pipeline for valid input', async () => {
    render(<Enquiries />);

    userEvent.click(screen.getByRole('button', { name: 'New Enquiry' }));

    userEvent.type(screen.getByPlaceholderText('Customer Name *'), 'ALPHA LEVEL PVT LTD');
    userEvent.type(screen.getByPlaceholderText('Contact Person *'), 'Purchase Team');
    userEvent.type(screen.getByPlaceholderText('Type or Select Grade *'), '304L');
    userEvent.type(screen.getByPlaceholderText('Payment Terms *'), '30 Days');

    const dateInput = document.querySelector('input[type="date"]');
    userEvent.clear(dateInput);
    userEvent.type(dateInput, '2026-03-20');

    userEvent.click(screen.getByRole('button', { name: 'Save Enquiry' }));

    await waitFor(() => {
      expect(dealsApi.createDeal).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText('Enquiry saved and synced to Sales Pipeline.')).toBeInTheDocument();
  });
});
