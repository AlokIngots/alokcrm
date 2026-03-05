import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SalesActivityReport from './SalesActivityReport';

jest.mock('./api/reports', () => ({
  reportsApi: {
    getFinancialYears: jest.fn(),
    getFilterOptions: jest.fn(),
    getActivityReport: jest.fn(),
  },
}));

jest.mock('../../utils/excelExport', () => ({
  exportReportsToExcel: jest.fn(),
}));

const { reportsApi } = require('./api/reports');

describe('SalesActivityReport filters', () => {
  beforeEach(() => {
    localStorage.setItem('access_token', 'test-token');
    reportsApi.getFinancialYears.mockResolvedValue(['2025-2026']);
    reportsApi.getFilterOptions.mockResolvedValue({
      access_level: 'A',
      divisions: [
        { code: 'TPT', name: 'Local' },
        { code: 'SCM', name: 'Export' },
      ],
      salespeople: [
        { ECode: 'EMP001', Name: 'Alice Johnson' },
        { ECode: 'EMP002', Name: 'Bob Smith' },
      ],
    });
    reportsApi.getActivityReport.mockResolvedValue({});
  });

  test('shows Local/Export divisions and all-salesperson option', async () => {
    render(<SalesActivityReport />);

    await waitFor(() => {
      expect(reportsApi.getFinancialYears).toHaveBeenCalled();
      expect(reportsApi.getFilterOptions).toHaveBeenCalled();
      expect(reportsApi.getActivityReport).toHaveBeenCalled();
    });

    const selects = await screen.findAllByRole('combobox');
    const divisionSelect = selects[1];
    expect(divisionSelect).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Local' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Export' })).toBeInTheDocument();

    const salespersonSelect = selects[2];
    expect(salespersonSelect).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'All Salespersons' })).toBeInTheDocument();
  });

  test('resets salesperson when division changes', async () => {
    render(<SalesActivityReport />);

    await waitFor(() => {
      expect(reportsApi.getFinancialYears).toHaveBeenCalled();
      expect(reportsApi.getFilterOptions).toHaveBeenCalled();
      expect(reportsApi.getActivityReport).toHaveBeenCalled();
    });

    const selects = await screen.findAllByRole('combobox');
    const divisionSelect = selects[1];
    const salespersonSelect = selects[2];

    await userEvent.selectOptions(salespersonSelect, 'EMP001');
    expect(salespersonSelect.value).toBe('EMP001');

    await userEvent.selectOptions(divisionSelect, 'SCM');
    await waitFor(() => {
      expect(salespersonSelect.value).toBe('');
    });
  });
});
