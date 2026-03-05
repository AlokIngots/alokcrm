/**
 * Format a number as Indian currency with Lakhs/Crores display
 * @param {number} amount - Amount to format
 * @returns {string} Formatted amount with Indian currency symbol
 */
export const formatIndianCurrency = (amount) => {
  if (!amount && amount !== 0) return '₹0';
  
  const numericAmount = parseFloat(amount);
  if (isNaN(numericAmount)) return '₹0';
  
  // 100 lakhs = 10,000,000
  const hundredLakhs = 10000000;
  
  if (numericAmount >= hundredLakhs) {
    // Convert to crores and show with 2 decimal places
    const crores = numericAmount / 10000000;
    return `₹${crores.toFixed(2)} Cr`;
  } else {
    // Convert to lakhs and show without decimal places
    const lakhs = numericAmount / 100000;
    return `₹${Math.round(lakhs)} Lakhs`;
  }
};
  
/**
 * Parse and validate deal value
 * @param {any} value - Value to parse
 * @returns {number} Parsed numeric value or 0
 */
export const parseDealValue = (value) => {
  if (!value && value !== 0) return 0;
  
  const parsed = parseFloat(value);
  return isNaN(parsed) ? 0 : parsed;
};
  
/**
 * Format date in Indian format
 * @param {string} dateString - Date string to format
 * @returns {string} Formatted date
 */
export const formatDate = (dateString) => {
  if (!dateString) return 'No date set';
  try {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return 'Invalid date';
  }
};