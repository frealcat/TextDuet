import { describe, expect, it, vi } from 'vitest';
import {
  fetchOfficialModelPricing,
  MAX_OFFICIAL_PRICING_RESPONSE_BYTES,
} from '@/src/providers/official-pricing';

describe('official model pricing', () => {
  it('maps exact OpenRouter model pricing from USD per token to USD per million tokens', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [
        {
          id: 'openai/example-mini',
          pricing: { prompt: '0.0000004', completion: '0.0000016' },
        },
      ],
    }), { status: 200 }));

    await expect(fetchOfficialModelPricing(
      'https://openrouter.ai/api/v1',
      'openai/example-mini',
      fetchMock,
    )).resolves.toMatchObject({
      status: 'available',
      model: 'openai/example-mini',
      currency: 'USD',
      inputPerMillion: 0.4,
      outputPerMillion: 1.6,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/models',
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    );
  });

  it('does not make a request for providers without a public structured price API', async () => {
    const fetchMock = vi.fn();
    await expect(fetchOfficialModelPricing(
      'https://dashscope.aliyuncs.com/compatible-mode/v1',
      'qwen-plus',
      fetchMock,
    )).resolves.toEqual({ status: 'unavailable' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('hides missing, malformed, negative, or non-finite prices', async () => {
    const responses = [
      { data: [] },
      { data: [{ id: 'model', pricing: { prompt: '-1', completion: '0.1' } }] },
      { data: [{ id: 'model', pricing: { prompt: 'NaN', completion: '0.1' } }] },
    ];

    for (const body of responses) {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(body), { status: 200 }),
      );
      await expect(fetchOfficialModelPricing(
        'https://openrouter.ai/api/v1',
        'model',
        fetchMock,
      )).resolves.toEqual({ status: 'unavailable' });
    }
  });

  it('returns unavailable without leaking response details on network and HTTP failures', async () => {
    await expect(fetchOfficialModelPricing(
      'https://openrouter.ai/api/v1',
      'model',
      vi.fn().mockRejectedValue(new Error('private network detail')),
    )).resolves.toEqual({ status: 'unavailable' });

    await expect(fetchOfficialModelPricing(
      'https://openrouter.ai/api/v1',
      'model',
      vi.fn().mockResolvedValue(new Response('private body', { status: 403 })),
    )).resolves.toEqual({ status: 'unavailable' });
  });

  it('returns unavailable when the catalogue response exceeds the byte ceiling', async () => {
    await expect(fetchOfficialModelPricing(
      'https://openrouter.ai/api/v1',
      'model',
      vi.fn().mockResolvedValue(new Response(
        new Uint8Array(MAX_OFFICIAL_PRICING_RESPONSE_BYTES + 1),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )),
    )).resolves.toEqual({ status: 'unavailable' });
  });
});
