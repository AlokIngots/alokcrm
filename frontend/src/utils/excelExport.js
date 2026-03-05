import * as XLSX from 'xlsx';

/**
 * Export targets data to Excel
 * @param {Array} targetData - Array of target data objects
 * @param {string} userName - Name of the user for filename
 * @param {string} financialYear - Financial year for filename
 */
export const exportTargetsToExcel = (targetData, userName, financialYear) => {
  if (!targetData || targetData.length === 0) {
    throw new Error('No data to export');
  }

  const months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
  
  // Prepare data for Excel
  const excelData = targetData.map(row => {
    const rowData = { Account: row.Account };
    
    // Add monthly data
    months.forEach(month => {
      rowData[month] = row[month] || 0;
    });
    
    // Calculate total
    const total = months.reduce((sum, month) => sum + (row[month] || 0), 0);
    rowData.Total = total;
    
    return rowData;
  });

  // Add summary row
  const summaryRow = { Account: 'TOTAL' };
  months.forEach(month => {
    summaryRow[month] = targetData.reduce((sum, row) => sum + (row[month] || 0), 0);
  });
  summaryRow.Total = targetData.reduce((sum, row) => {
    return sum + months.reduce((monthSum, month) => monthSum + (row[month] || 0), 0);
  }, 0);
  
  excelData.push(summaryRow);

  // Create workbook and worksheet
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(excelData);

  // Set column widths
  const colWidths = [
    { wch: 40 }, // Account column (wider)
    ...months.map(() => ({ wch: 12 })), // Month columns
    { wch: 15 } // Total column
  ];
  ws['!cols'] = colWidths;

  // Style the header row
  const headerRange = XLSX.utils.decode_range(ws['!ref']);
  for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
    if (!ws[cellAddress]) continue;
    ws[cellAddress].s = {
      font: { bold: true },
      fill: { fgColor: { rgb: 'CCCCCC' } }
    };
  }

  // Style the summary row
  const lastRow = excelData.length - 1;
  for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: lastRow + 1, c: col });
    if (!ws[cellAddress]) continue;
    ws[cellAddress].s = {
      font: { bold: true },
      fill: { fgColor: { rgb: 'E3F2FD' } }
    };
  }

  XLSX.utils.book_append_sheet(wb, ws, 'Targets');

  // Generate filename
  const sanitizedUserName = userName.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `Targets_${sanitizedUserName}_FY${financialYear}_${new Date().toISOString().split('T')[0]}.xlsx`;

  // Download file
  XLSX.writeFile(wb, filename);
};

/**
 * Export sales activity report data to Excel
 * @param {Object} reportData - Report data object with months as keys
 * @param {Object} stageTotals - Stage totals object
 * @param {Array} allStages - Array of all pipeline stage keys
 * @param {Array} allMonths - Array of all months
 * @param {Object} filters - Applied filters for filename
 * @param {Object} pipelineStages - PIPELINE_STAGES config object for titles
 */
export const exportReportsToExcel = (reportData, stageTotals, allStages, allMonths, filters = {}, pipelineStages = {}) => {
  if (!reportData || Object.keys(reportData).length === 0) {
    throw new Error('No data to export');
  }

  // Prepare data for Excel
  const excelData = allStages.map(stage => {
    const stageTitle = pipelineStages[stage]?.title || stage;
    const rowData = { 'Deal Stage': stageTitle };
    
    // Add total column first
    rowData.Total = stageTotals[stage] || 0;
    
    // Add monthly data
    allMonths.forEach(month => {
      rowData[month] = reportData[month]?.[stage] || 0;
    });
    
    return rowData;
  });

  // Add totals row
  const totalsRow = { 'Deal Stage': 'TOTAL' };
  totalsRow.Total = Object.values(stageTotals).reduce((sum, val) => sum + val, 0);
  
  allMonths.forEach(month => {
    totalsRow[month] = allStages.reduce((sum, stage) => {
      return sum + (reportData[month]?.[stage] || 0);
    }, 0);
  });
  
  excelData.push(totalsRow);

  // Create workbook and worksheet
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(excelData);

  // Set column widths
  const colWidths = [
    { wch: 25 }, // Deal Stage column
    { wch: 12 }, // Total column
    ...allMonths.map(() => ({ wch: 10 })) // Month columns
  ];
  ws['!cols'] = colWidths;

  // Style the header row
  const headerRange = XLSX.utils.decode_range(ws['!ref']);
  for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
    if (!ws[cellAddress]) continue;
    ws[cellAddress].s = {
      font: { bold: true },
      fill: { fgColor: { rgb: 'CCCCCC' } }
    };
  }

  // Style the totals row
  const lastRow = excelData.length - 1;
  for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: lastRow + 1, c: col });
    if (!ws[cellAddress]) continue;
    ws[cellAddress].s = {
      font: { bold: true },
      fill: { fgColor: { rgb: 'E8F5E8' } }
    };
  }

  XLSX.utils.book_append_sheet(wb, ws, 'Sales Activity Report');

  // Generate filename
  let filename = 'Sales_Activity_Report';
  
  if (filters.division) filename += `_${filters.division}`;
  if (filters.zone) filename += `_${filters.zone}`;
  if (filters.cluster) filename += `_${filters.cluster}`;
  if (filters.salesperson) filename += `_${filters.salesperson}`;
  if (filters.from_date) filename += `_from_${filters.from_date}`;
  if (filters.to_date) filename += `_to_${filters.to_date}`;
  
  filename += `_${new Date().toISOString().split('T')[0]}.xlsx`;
  
  // Sanitize filename
  filename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');

  // Download file
  XLSX.writeFile(wb, filename);
};

/**
 * Export target vs actuals report data to Excel
 * @param {Object} reportData - Report data object with months as keys
 * @param {Object} totals - Totals object with PY, TARGET and ACTUALS
 * @param {Array} allMonths - Array of all months
 */
export const exportTargetVsActualsToExcel = (reportData, totals, allMonths) => {
  if (!reportData || Object.keys(reportData).length === 0) {
    throw new Error('No data to export');
  }

  // Prepare data for Excel
  const excelData = [];

  // Previous Year row
  const pyRow = { 'Type': 'Actual (PY)' };
  pyRow.Total = (totals.PY || 0).toFixed(2);
  allMonths.forEach(month => {
    pyRow[month] = (reportData[month]?.PY || 0).toFixed(2);
  });
  excelData.push(pyRow);

  // Target row
  const targetRow = { 'Type': 'Target (CY)' };
  targetRow.Total = (totals.TARGET || 0).toFixed(2);
  allMonths.forEach(month => {
    targetRow[month] = (reportData[month]?.TARGET || 0).toFixed(2);
  });
  excelData.push(targetRow);

  // Actuals row
  const actualsRow = { 'Type': 'Actual (CY)' };
  actualsRow.Total = (totals.ACTUALS || 0).toFixed(2);
  allMonths.forEach(month => {
    actualsRow[month] = (reportData[month]?.ACTUALS || 0).toFixed(2);
  });
  excelData.push(actualsRow);

  // YoY Growth (₹) row
  const yoyRupeesRow = { 'Type': 'YoY Growth (₹)' };
  if (totals.ACTUALS === 0) {
    yoyRupeesRow.Total = '-';
  } else {
    const growth = totals.ACTUALS - totals.PY;
    yoyRupeesRow.Total = growth.toFixed(2);
  }
  allMonths.forEach(month => {
    const actuals = reportData[month]?.ACTUALS || 0;
    const py = reportData[month]?.PY || 0;
    if (actuals === 0) {
      yoyRupeesRow[month] = '-';
    } else {
      const growth = actuals - py;
      yoyRupeesRow[month] = growth.toFixed(2);
    }
  });
  excelData.push(yoyRupeesRow);

  // YoY Growth (%) row
  const yoyPercentRow = { 'Type': 'YoY Growth (%)' };
  if (totals.ACTUALS === 0 || totals.PY === 0) {
    yoyPercentRow.Total = '-';
  } else {
    const growthPercent = ((totals.ACTUALS - totals.PY) / totals.PY) * 100;
    yoyPercentRow.Total = `${growthPercent.toFixed(2)}%`;
  }
  allMonths.forEach(month => {
    const actuals = reportData[month]?.ACTUALS || 0;
    const py = reportData[month]?.PY || 0;
    if (actuals === 0 || py === 0) {
      yoyPercentRow[month] = '-';
    } else {
      const growthPercent = ((actuals - py) / py) * 100;
      yoyPercentRow[month] = `${growthPercent.toFixed(2)}%`;
    }
  });
  excelData.push(yoyPercentRow);

  // Achievement % row
  const achievementRow = { 'Type': 'Achievement (%)' };
  achievementRow.Total = totals.TARGET > 0 ? `${((totals.ACTUALS / totals.TARGET) * 100).toFixed(2)}%` : '0.00%';
  allMonths.forEach(month => {
    const target = reportData[month]?.TARGET || 0;
    const actuals = reportData[month]?.ACTUALS || 0;
    const achievement = target > 0 ? ((actuals / target) * 100).toFixed(2) : '0.00';
    achievementRow[month] = `${achievement}%`;
  });
  excelData.push(achievementRow);

  // Create workbook and worksheet
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(excelData);

  // Set column widths
  const colWidths = [
    { wch: 15 }, // Type column
    { wch: 12 }, // Total column
    ...allMonths.map(() => ({ wch: 10 })) // Month columns
  ];
  ws['!cols'] = colWidths;

  // Style the header row
  const headerRange = XLSX.utils.decode_range(ws['!ref']);
  for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
    if (!ws[cellAddress]) continue;
    ws[cellAddress].s = {
      font: { bold: true },
      fill: { fgColor: { rgb: 'CCCCCC' } }
    };
  }

  // Style the achievement row
  const achievementRowIndex = 5; // 0-based, so row 6 (Achievement %)
  for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: achievementRowIndex + 1, c: col });
    if (!ws[cellAddress]) continue;
    ws[cellAddress].s = {
      font: { bold: true },
      fill: { fgColor: { rgb: 'E8F5E8' } }
    };
  }

  XLSX.utils.book_append_sheet(wb, ws, 'Target vs Actuals Report');

  // Generate filename with current date
  const filename = `Target_vs_Actuals_${new Date().toISOString().split('T')[0]}.xlsx`;

  // Download file
  XLSX.writeFile(wb, filename);
}; 