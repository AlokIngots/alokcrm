// Utility functions for account data handling
export const convertTurnover = (value, unit) => {
    if (!value || isNaN(value)) return null;
    const numValue = parseFloat(value);
    
    switch (unit) {
      case 'Lakhs':
        return numValue * 100000;
      case 'Crores':
        return numValue * 10000000;
      case 'INR':
      default:
        return numValue;
    }
  };
  
  // Convert stored turnover back to display format
  export const convertTurnoverForDisplay = (value) => {
    if (!value || isNaN(value)) return { amount: '', unit: 'INR' };
    
    const numValue = parseFloat(value);
    
    // Check if it's in crores (divisible by 10,000,000)
    if (numValue >= 10000000 && numValue % 10000000 === 0) {
      return { amount: (numValue / 10000000).toString(), unit: 'Crores' };
    }
    // Check if it's in lakhs (divisible by 100,000)
    else if (numValue >= 100000 && numValue % 100000 === 0) {
      return { amount: (numValue / 100000).toString(), unit: 'Lakhs' };
    }
    // Otherwise display as INR
    else {
      return { amount: numValue.toString(), unit: 'INR' };
    }
  };
  
  // Validate website URL
  export const validateWebsite = (url) => {
    if (!url) return true; // Optional field
        const urlPattern = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/i;
    return urlPattern.test(url);
  };
  
  // Format website with protocol
  export const formatWebsiteWithProtocol = (website) => {
    if (!website) return null;
    
    let formattedWebsite = website.trim();
    // Add protocol if missing
    if (!formattedWebsite.startsWith('http://') && !formattedWebsite.startsWith('https://')) {
      formattedWebsite = 'https://' + formattedWebsite;
    }
    return formattedWebsite;
  };
  
  
  // Format currency in Indian system
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