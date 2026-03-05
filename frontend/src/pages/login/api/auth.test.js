import { authApi, tokenManager } from './auth';

describe('authApi critical flow', () => {
  beforeEach(() => {
    localStorage.clear();
    global.fetch = jest.fn();
  });

  test('sendOTP calls login endpoint with ECode payload', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ session_id: 's1', message: 'OTP sent' })
    });

    const result = await authApi.sendOTP('EMP001');

    expect(result.session_id).toBe('s1');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/auth/login'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ ECode: 'EMP001' })
      })
    );
  });

  test('verifyOTP stores token and user', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'token-123',
        user: { ECode: 'EMP001', Name: 'Renu Lobo' }
      })
    });

    const result = await authApi.verifyOTP('s1', '123456');

    expect(result.access_token).toBe('token-123');
    expect(tokenManager.getToken()).toBe('token-123');
    expect(JSON.parse(localStorage.getItem('current_user')).ECode).toBe('EMP001');
  });
});

