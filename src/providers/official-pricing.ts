import * as z from 'zod/mini';
import type { OfficialModelPricing } from '@/src/core/contracts';
import { getLocalDateKey } from '@/src/core/cost';
import { getOfficialPricingSource } from '@/src/core/pricing-sources';
import { readJsonResponseWithLimit } from './response-body';

const OPENROUTER_MODELS_API = 'https://openrouter.ai/api/v1/models';
/** OpenRouter's model catalogue is larger than normal provider responses. */
export const MAX_OFFICIAL_PRICING_RESPONSE_BYTES = 8 * 1024 * 1024;

const OpenRouterModelsResponseSchema = z.object({
  data: z.array(z.object({
    id: z.string(),
    pricing: z.object({
      prompt: z.string(),
      completion: z.string(),
    }),
  })),
});

/** Queries only official structured pricing APIs that work without privileged billing keys. */
export async function fetchOfficialModelPricing(
  baseUrl: string,
  model: string,
  fetchImplementation: typeof fetch = fetch,
): Promise<OfficialModelPricing> {
  const source = getOfficialPricingSource(baseUrl);
  if (source?.id !== 'openrouter' || !model.trim()) {
    return { status: 'unavailable' };
  }

  try {
    const response = await fetchImplementation(OPENROUTER_MODELS_API, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return { status: 'unavailable' };

    const rawBody: unknown = await readJsonResponseWithLimit(
      response,
      MAX_OFFICIAL_PRICING_RESPONSE_BYTES,
    );
    const parsed = OpenRouterModelsResponseSchema.safeParse(rawBody);
    if (!parsed.success) return { status: 'unavailable' };

    const match = parsed.data.data.find((item) => item.id === model.trim());
    if (!match) return { status: 'unavailable' };
    const inputPerMillion = parsePerMillionPrice(match.pricing.prompt);
    const outputPerMillion = parsePerMillionPrice(match.pricing.completion);
    if (inputPerMillion === null || outputPerMillion === null) {
      return { status: 'unavailable' };
    }

    return {
      status: 'available',
      providerLabel: source.providerLabel,
      model: match.id,
      currency: 'USD',
      inputPerMillion,
      outputPerMillion,
      checkedAt: getLocalDateKey(),
      sourceUrl: source.url,
    };
  } catch {
    return { status: 'unavailable' };
  }
}

function parsePerMillionPrice(value: string): number | null {
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) return null;
  const perToken = Number(value);
  const perMillion = Math.round(perToken * 1_000_000 * 1_000_000_000) / 1_000_000_000;
  return Number.isFinite(perMillion) && perMillion >= 0 ? perMillion : null;
}
