// Lead sources configuration
export const LEAD_SOURCES = [
    'Internal Reference',
    'Client Reference',
    'Email Campaign',
    'Company Website',
    'Inbound Inquiry',
    'Event/Trade Fair',
    'Online Outreach (LinkedIn/Other)',
    'Cold Call'  
  ];
  
  export const getLeadSourceOptions = () => {
    return LEAD_SOURCES.map(source => ({
      value: source,
      label: source
    }));
  };
  
  export const isValidLeadSource = (leadSource) => {
    return LEAD_SOURCES.includes(leadSource);
  };