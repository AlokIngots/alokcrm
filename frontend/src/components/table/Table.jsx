import React, { useState, useRef, useEffect } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
} from '@tanstack/react-table';
import { TableCellsIcon } from '@heroicons/react/24/outline';

const Table = ({ 
  data = [], 
  columns = [],
  isLoading = false,
  pageSize = 10,
  enableGlobalFilter = true,
  enableColumnFilters = true,
  enableSorting = true,
  enablePagination = true,
}) => {
  const [sorting, setSorting] = useState([]);
  const [columnFilters, setColumnFilters] = useState([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: pageSize,
  });
  const [openFilterDropdown, setOpenFilterDropdown] = useState(null);
  const filterRefs = useRef({});

  // Custom fuzzy filter function
  const fuzzyFilter = (row, columnId, value, addMeta) => {
    // Get the cell value
    const itemValue = row.getValue(columnId);
    
    // Convert to string and normalize
    const searchValue = String(value).toLowerCase().trim();
    const cellValue = String(itemValue || '').toLowerCase();
    
    // If empty search, show all
    if (!searchValue) return true;
    
    // Exact match gets highest priority
    if (cellValue.includes(searchValue)) return true;
    
    // Fuzzy matching - check if all characters of search exist in order
    let searchIndex = 0;
    for (let i = 0; i < cellValue.length && searchIndex < searchValue.length; i++) {
      if (cellValue[i] === searchValue[searchIndex]) {
        searchIndex++;
      }
    }
    
    return searchIndex === searchValue.length;
  };

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      pagination,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    enableSorting,
    enableFilters: enableColumnFilters,
    enableGlobalFilter,
    // Use custom filter function for all columns
    filterFns: {
      fuzzy: fuzzyFilter,
    },
    globalFilterFn: fuzzyFilter,
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openFilterDropdown && filterRefs.current[openFilterDropdown] && 
          !filterRefs.current[openFilterDropdown].contains(event.target)) {
        setOpenFilterDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openFilterDropdown]);

  const toggleFilterDropdown = (columnId) => {
    setOpenFilterDropdown(openFilterDropdown === columnId ? null : columnId);
  };

  const FilterDropdown = ({ column }) => {
    const [filterValue, setFilterValue] = useState(column.getFilterValue() ?? '');
    
    const handleApplyFilter = () => {
      column.setFilterValue(filterValue);
      setOpenFilterDropdown(null);
    };

    const handleClearFilter = () => {
      setFilterValue('');
      column.setFilterValue('');
      setOpenFilterDropdown(null);
    };

    // Handle Enter key press
    const handleKeyPress = (e) => {
      if (e.key === 'Enter') {
        handleApplyFilter();
      }
    };

    return (
      <div className="relative">
        <div 
          ref={(el) => filterRefs.current[column.id] = el}
          className="absolute top-2 left-0 bg-white border border-gray-200 rounded-lg shadow-xl p-4 min-w-[280px] z-[9999]"
          style={{ 
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            zIndex: 9999 
          }}
        >
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search {flexRender(column.columnDef.header, {})}
              </label>
              <input
                type="text"
                placeholder={`Search ${column.columnDef.header}...`}
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
                onKeyPress={handleKeyPress}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleApplyFilter}
                className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              >
                Filter
              </button>
              <button
                onClick={handleClearFilter}
                className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-lg border border-gray-100">
        <div className="p-8">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded-lg w-1/4 mb-6"></div>
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-4 bg-gray-200 rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
      {/* Global Search */}
      {enableGlobalFilter && (
        <div className="px-8 py-6 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search all columns..."
                value={globalFilter ?? ''}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white shadow-sm"
              />
            </div>
            <button
              onClick={() => {
                setGlobalFilter('');
                setColumnFilters([]);
              }}
              className="px-6 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 shadow-sm"
            >
              Clear All
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto max-h-[calc(100vh-310px)] overflow-y-auto">
        <table className="w-full">
          <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-8 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider relative"
                  >
                    <div className="flex items-center gap-3">
                      <span 
                        className={enableSorting && header.column.getCanSort() ? 'cursor-pointer hover:text-gray-800 transition-colors duration-200' : ''}
                        onClick={enableSorting ? header.column.getToggleSortingHandler() : undefined}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </span>
                      
                      <div className="flex items-center gap-2">
                        {/* Sort Icon */}
                        {enableSorting && header.column.getCanSort() && (
                          <button
                            onClick={header.column.getToggleSortingHandler()}
                            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-md hover:bg-gray-200 transition-all duration-200"
                            title="Sort column"
                          >
                            <span className="text-sm font-bold">
                              {{
                                asc: '↑',
                                desc: '↓',
                              }[header.column.getIsSorted()] ?? '⇅'}
                            </span>
                          </button>
                        )}
                        
                        {/* Filter Icon */}
                        {enableColumnFilters && header.column.getCanFilter() && (
                          <button
                            onClick={() => toggleFilterDropdown(header.id)}
                            className={`p-1.5 rounded-md transition-all duration-200 ${
                              header.column.getFilterValue() 
                                ? 'text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100' 
                                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-200'
                            }`}
                            title="Filter column"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.707A1 1 0 013 7V4z" />
                            </svg>
                          </button>
                        )}
                      </div>

                      {/* Filter Dropdown */}
                      {openFilterDropdown === header.id && header.column.getCanFilter() && (
                        <FilterDropdown column={header.column} />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-8 py-12 text-center text-gray-500">
                  <div className="flex flex-col items-center">
                    <TableCellsIcon className="w-12 h-12 text-gray-300 mb-4" />
                    <p className="text-lg font-medium text-gray-400 mb-1">
                      {columnFilters.length > 0 || globalFilter ? 
                        "No results found" : 
                        "No data available"
                      }
                    </p>
                    <p className="text-sm text-gray-400">
                      {columnFilters.length > 0 || globalFilter ? 
                        "Try adjusting your search or filter criteria" : 
                        "Data will appear here when available"
                      }
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row, index) => (
                <tr key={row.id} className={`hover:bg-gray-50 transition-colors duration-150 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-25'}`}>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-8 py-4 whitespace-nowrap text-sm text-gray-900">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {enablePagination && (
        <div className="px-8 py-6 border-t border-gray-100 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 font-medium">
                Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} to{' '}
                {Math.min(
                  (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
                  table.getFilteredRowModel().rows.length
                )}{' '}
                of <span className="font-semibold text-gray-900">{table.getFilteredRowModel().rows.length}</span> results
              </span>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={table.getState().pagination.pageSize}
                onChange={(e) => {
                  table.setPageSize(Number(e.target.value));
                }}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
              >
                {[10, 20, 30, 40, 50].map((pageSize) => (
                  <option key={pageSize} value={pageSize}>
                    Show {pageSize}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => table.setPageIndex(0)}
                  disabled={!table.getCanPreviousPage()}
                  className="px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
                  title="First page"
                >
                  ««
                </button>
                <button
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  className="px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
                  title="Previous page"
                >
                  ‹
                </button>

                <span className="px-4 py-2 text-sm text-gray-700 font-medium bg-gray-100 rounded-lg">
                  Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
                </span>

                <button
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  className="px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
                  title="Next page"
                >
                  ›
                </button>
                <button
                  onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                  disabled={!table.getCanNextPage()}
                  className="px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
                  title="Last page"
                >
                  »»
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Table;
