export const INDUSTRY_OPTIONS = [
  'Pumps',
  'Valves',
  'CNC / Machining',
  'Forgings',
  'Auto Components',
  'Engineering & Fabrication',
  'Oil & Gas',
  'Power & Energy',
  'Chemical & Process',
  'EPC / Projects',
  'Trader / Stockist',
  'OEM',
  'Export House',
  'Other'
];

export const INDUSTRY_COLORS = {
  'Pumps': 'bg-blue-100 text-blue-700 border border-blue-200',
  'Valves': 'bg-cyan-100 text-cyan-700 border border-cyan-200',
  'CNC / Machining': 'bg-indigo-100 text-indigo-700 border border-indigo-200',
  'Forgings': 'bg-amber-100 text-amber-700 border border-amber-200',
  'Auto Components': 'bg-violet-100 text-violet-700 border border-violet-200',
  'Engineering & Fabrication': 'bg-green-100 text-green-700 border border-green-200',
  'Oil & Gas': 'bg-orange-100 text-orange-700 border border-orange-200',
  'Power & Energy': 'bg-yellow-100 text-yellow-700 border border-yellow-200',
  'Chemical & Process': 'bg-red-100 text-red-700 border border-red-200',
  'EPC / Projects': 'bg-teal-100 text-teal-700 border border-teal-200',
  'Trader / Stockist': 'bg-purple-100 text-purple-700 border border-purple-200',
  'OEM': 'bg-slate-100 text-slate-700 border border-slate-200',
  'Export House': 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  'Other': 'bg-gray-100 text-gray-700 border border-gray-200',
};


/**
 * Get industry options as an array
 * @returns {Array<string>} Array of industry strings
 */
export const getIndustryOptions = () => {
  return [...INDUSTRY_OPTIONS].sort((a, b) => a.localeCompare(b));
};

/**
 * Get industry colors mapping
 * @returns {Object} Object mapping industry names to color classes
 */
export const getIndustryColors = () => {
  return { ...INDUSTRY_COLORS };
};

/**
 * Get color for a specific industry
 * @param {string} industry - The industry name
 * @returns {string} The color classes for the industry
 */
export const getIndustryColor = (industry) => {
  return INDUSTRY_COLORS[industry] || INDUSTRY_COLORS['Other'];
};
