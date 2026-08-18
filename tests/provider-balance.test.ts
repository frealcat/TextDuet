import { describe, expect, it, vi } from 'vitest';
import { fetchProviderBalance } from '@/src/providers/provider-balance';

const settings = {
  provider: 'openai-compatible' as const,
  baseUrl: 'https://api.deepseek.com',
  model: 'deepseek-chat',
  apiKeyPersistence: 'session' as const,
  targetLanguage: 'zh-CN',
  displayMode: 'bilingual' as const,
  customSystemPrompt: '',
};

describe('Provider balance', () => {
  it('queries the official DeepSeek balance endpoint with the trusted Key', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      is_available: true,
      balance_infos: [{
        currency: 'CNY',
        total_balance: '12.50',
        granted_balance: '2.50',
        topped_up_balance: '10.00',
      }],
    }), { status: 200 }));

    await expect(fetchProviderBalance(
      settings,
      'local-test-placeholder',
      fetchMock,
    )).resolves.toMatchObject({
      status: 'available',
      providerLabel: 'DeepSeek',
      isAvailable: true,
      balances: [{ currency: 'CNY', totalBalance: '12.50' }],
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.deepseek.com/user/balance',
      expect.objectContaining({
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer local-test-placeholder',
        },
      }),
    );
  });

  it('does not send the Key to custom compatible endpoints', async () => {
    const fetchMock = vi.fn();
    await expect(fetchProviderBalance(
      { ...settings, baseUrl: 'https://deepseek-proxy.example/v1' },
      'local-test-placeholder',
      fetchMock,
    )).resolves.toEqual({ status: 'unsupported' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects malformed balances and returns safe HTTP errors', async () => {
    await expect(fetchProviderBalance(
      settings,
      'local-test-placeholder',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({
        is_available: true,
        balance_infos: [{ currency: 'CNY', total_balance: '-1' }],
      }), { status: 200 })),
    )).rejects.toThrow('余额接口返回格式不正确');

    await expect(fetchProviderBalance(
      settings,
      'local-test-placeholder',
      vi.fn().mockResolvedValue(new Response('private response body', { status: 401 })),
    )).rejects.toThrow('DeepSeek 拒绝认证');
  });
});
