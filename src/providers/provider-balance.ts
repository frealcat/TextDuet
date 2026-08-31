import * as z from 'zod/mini';
import type { ProviderBalance, ProviderSettings } from '@/src/core/contracts';
import { getLocalDateKey } from '@/src/core/cost';
import {
  readJsonResponseWithLimit,
  ResponseBodyTooLargeError,
} from './response-body';

const DEEPSEEK_API_ORIGIN = 'https://api.deepseek.com';
const DEEPSEEK_BALANCE_API = `${DEEPSEEK_API_ORIGIN}/user/balance`;
const DEEPSEEK_BALANCE_DOCS = 'https://api-docs.deepseek.com/api/get-user-balance';
/** The balance envelope is intentionally tiny; reject oversized responses. */
export const MAX_PROVIDER_BALANCE_RESPONSE_BYTES = 256 * 1024;
const BalanceAmountSchema = z.string().check(
  z.minLength(1),
  z.maxLength(64),
  z.regex(/^(?:0|[1-9]\d*)(?:\.\d+)?$/),
);
const DeepSeekBalanceResponseSchema = z.object({
  is_available: z.boolean(),
  balance_infos: z.array(z.object({
    currency: z.enum(['CNY', 'USD']),
    total_balance: BalanceAmountSchema,
    granted_balance: BalanceAmountSchema,
    topped_up_balance: BalanceAmountSchema,
  })).check(z.minLength(1), z.maxLength(2)),
});

/** Queries balances only for the exact official DeepSeek API origin. */
export async function fetchProviderBalance(
  settings: ProviderSettings,
  apiKey: string,
  fetchImplementation: typeof fetch = fetch,
): Promise<ProviderBalance> {
  if (!isOfficialDeepSeekBaseUrl(settings.baseUrl)) {
    return { status: 'unsupported' };
  }
  if (!apiKey.trim()) {
    throw new Error('请先保存 DeepSeek API Key');
  }

  const response = await fetchImplementation(DEEPSEEK_BALANCE_API, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    signal: AbortSignal.timeout(15_000),
  }).catch(() => {
    throw new Error('无法连接 DeepSeek 余额接口，请稍后重试');
  });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('DeepSeek 拒绝认证，请检查已保存的 API Key');
    }
    if (response.status === 429) {
      throw new Error('DeepSeek 余额接口请求过于频繁，请稍后重试');
    }
    throw new Error('DeepSeek 余额接口暂时不可用，请稍后重试');
  }

  const rawBody: unknown = await readJsonResponseWithLimit(
    response,
    MAX_PROVIDER_BALANCE_RESPONSE_BYTES,
  ).catch((error: unknown) => {
    if (error instanceof ResponseBodyTooLargeError) {
      throw new Error('余额接口响应超过大小限制');
    }
    return {};
  });
  const parsed = DeepSeekBalanceResponseSchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new Error('余额接口返回格式不正确');
  }

  return {
    status: 'available',
    providerLabel: 'DeepSeek',
    isAvailable: parsed.data.is_available,
    balances: parsed.data.balance_infos.map((balance) => ({
      currency: balance.currency,
      totalBalance: balance.total_balance,
      grantedBalance: balance.granted_balance,
      toppedUpBalance: balance.topped_up_balance,
    })),
    checkedAt: getLocalDateKey(),
    sourceUrl: DEEPSEEK_BALANCE_DOCS,
  };
}

export function isOfficialDeepSeekBaseUrl(baseUrl: string): boolean {
  try {
    const url = new URL(baseUrl);
    return url.origin === DEEPSEEK_API_ORIGIN && !url.username && !url.password;
  } catch {
    return false;
  }
}
