import { PIPELINE_STAGES } from './pipeline-stages';

describe('PIPELINE_STAGES regression', () => {
  it('keeps expected business stage order and names', () => {
    const keys = Object.keys(PIPELINE_STAGES);
    expect(keys).toEqual(['NEW', 'FEASIBILITY', 'OFFER_SUBMITTED', 'DEAL_LOST', 'DEAL_WON']);
    expect(PIPELINE_STAGES.NEW.title).toBe('Enquiry');
    expect(PIPELINE_STAGES.OFFER_SUBMITTED.title).toBe('Offer');
    expect(PIPELINE_STAGES.DEAL_WON.title).toBe('Order Won');
    expect(PIPELINE_STAGES.DEAL_LOST.title).toBe('Order Lost');
  });
});

