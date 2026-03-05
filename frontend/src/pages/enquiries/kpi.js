export const buildEnquiryKpis = (rows = []) => {
  const normalize = (value) => String(value || '').trim().toUpperCase();
  const statuses = rows.map((r) => normalize(r.status));

  const reviewedCount = statuses.filter((s) => s.includes('REVIEW')).length;
  const quotedCount = statuses.filter((s) => s.includes('QUOTE') || s === 'OFFER_SUBMITTED').length;
  const wonCount = statuses.filter((s) => s.includes('WON') || s === 'DEAL_WON').length;
  const total = rows.length;
  const conversion = total > 0 ? `${Math.round((wonCount / total) * 100)}%` : '0%';

  return [
    { label: 'Total Enquiries', value: total },
    { label: 'Reviewed', value: reviewedCount },
    { label: 'Quoted', value: quotedCount },
    { label: 'Orders Received', value: wonCount },
    { label: 'Conversion Rate', value: conversion },
  ];
};

