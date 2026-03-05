import { dealsApi } from './deals';

describe('dealsApi critical flow', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('access_token', 'test-token');
    global.fetch = jest.fn();
  });

  test('updateDealStage sends PATCH to stage endpoint', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ID: 11, Stage: 'OFFER_SUBMITTED' })
    });

    const result = await dealsApi.updateDealStage(11, 'OFFER_SUBMITTED');

    expect(result.Stage).toBe('OFFER_SUBMITTED');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/deals/11/stage'),
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ Stage: 'OFFER_SUBMITTED' }),
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' })
      })
    );
  });

  test('downloadOfferLetter returns parsed filename and blob', async () => {
    const mockBlob = new Blob(['offer'], { type: 'text/html' });
    global.fetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'attachment; filename="offer-001.html"' },
      blob: async () => mockBlob
    });

    const result = await dealsApi.downloadOfferLetter(11);

    expect(result.filename).toBe('offer-001.html');
    expect(result.blob).toBe(mockBlob);
  });
});

