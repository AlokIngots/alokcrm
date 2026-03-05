// Division master configuration used across forms and UI.
// Keep backend codes (TPT/SCM/XPR) for API payloads, but show only Local/Export labels.

const DIVISION_STYLE = {
  LOCAL: {
    label: 'Local',
    badgeColor: 'bg-green-100 text-green-700',
    borderColor: 'border-green-300',
    ringColor: 'ring-green-500'
  },
  EXPORT: {
    label: 'Export',
    badgeColor: 'bg-blue-100 text-blue-700',
    borderColor: 'border-blue-300',
    ringColor: 'ring-blue-500'
  }
};

const normalizeDivision = (divisionValue) => {
  const value = String(divisionValue || '').trim().toLowerCase();

  if (!value) return 'LOCAL';

  if (
    value === 'tpt' ||
    value === 'local' ||
    value === 'local sale' ||
    value === 'dou01'
  ) {
    return 'LOCAL';
  }

  if (
    value === 'scm' ||
    value === 'xpr' ||
    value === 'export' ||
    value === 'exports' ||
    value === 'export sale' ||
    value.startsWith('dou')
  ) {
    return 'EXPORT';
  }

  return 'LOCAL';
};

export const getDivisionConfig = (divisionValue) => {
  return DIVISION_STYLE[normalizeDivision(divisionValue)] || DIVISION_STYLE.LOCAL;
};

// Keep backend values in options, show business labels in UI
export const getDivisionOptions = () => [
  { id: 'TPT', label: 'Local', ...DIVISION_STYLE.LOCAL },
  { id: 'SCM', label: 'Export', ...DIVISION_STYLE.EXPORT }
];

export const isValidDivision = (divisionValue) => {
  const value = String(divisionValue || '').trim().toUpperCase();
  return ['TPT', 'SCM', 'XPR', 'LOCAL', 'EXPORT', 'EXPORTS'].includes(value);
};

export const getDivisionLabel = (divisionValue) => {
  return getDivisionConfig(divisionValue).label;
};
