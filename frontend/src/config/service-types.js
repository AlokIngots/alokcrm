// Service types configuration by division
export const SERVICE_TYPES = {
    SCM: [
     'Warehouse Management',
     'In-Plant',
     'Contract Manufacturing',
     'Third-Party Purchase',
     'Milk Run',
     'Functional Support',
     'Equipment Hiring',
     'Product Packaging',
     'Distribution',
     'Yard Management'
    ],
    TPT: [
      'FTL',
      'PTL',
      'FTL & PTL'
    ],
    XPR: [
      'PDS',
    ]
  };
  
  export const getServiceTypesByDivision = (division) => {
    return SERVICE_TYPES[division] || [];
  };
  
  export const getAllServiceTypes = () => {
    return Object.values(SERVICE_TYPES).flat();
  };
  
  export const isValidServiceType = (serviceType, division) => {
    const divisionServices = SERVICE_TYPES[division] || [];
    return divisionServices.includes(serviceType);
  };