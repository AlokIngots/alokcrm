import { buildEnquiryKpis } from './kpi';

describe('buildEnquiryKpis', () => {
  it('returns zeroed KPI set for empty rows', () => {
    const kpis = buildEnquiryKpis([]);
    expect(kpis).toEqual([
      { label: 'Total Enquiries', value: 0 },
      { label: 'Reviewed', value: 0 },
      { label: 'Quoted', value: 0 },
      { label: 'Orders Received', value: 0 },
      { label: 'Conversion Rate', value: '0%' },
    ]);
  });

  it('counts statuses and conversion correctly', () => {
    const rows = [
      { status: 'REVIEWED' },
      { status: 'OFFER_SUBMITTED' },
      { status: 'DEAL_WON' },
      { status: 'NEW' },
    ];
    const kpis = buildEnquiryKpis(rows);
    expect(kpis[0].value).toBe(4);
    expect(kpis[1].value).toBe(1);
    expect(kpis[2].value).toBe(1);
    expect(kpis[3].value).toBe(1);
    expect(kpis[4].value).toBe('25%');
  });
});

