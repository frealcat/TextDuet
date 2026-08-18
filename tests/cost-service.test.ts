import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  recordUsage: vi.fn(),
  getTodayUsage: vi.fn(),
  maintainUsageLedger: vi.fn(),
}));

vi.mock('@/src/storage/settings', () => ({
  costSettingsStorage: {
    getValue: vi.fn(async () => ({
      version: 1,
      price: {
        enabled: false,
        model: '',
        currency: 'USD',
        inputPerMillion: 0,
        outputPerMillion: 0,
        updatedAt: '2026-08-14',
        source: 'user',
      },
      budget: { enabled: false, dailyLimit: 0 },
    })),
    setValue: vi.fn(),
  },
}));

vi.mock('@/src/storage/usage-ledger', () => ({
  clearUsageLedger: vi.fn(),
  getUsageHistory: vi.fn(),
  getTodayUsage: mocks.getTodayUsage,
  maintainUsageLedger: mocks.maintainUsageLedger,
  recordUsage: mocks.recordUsage,
}));

import { settleTranslation } from '@/src/storage/cost-service';

const providerSettings = {
  provider: 'openai-compatible' as const,
  baseUrl: 'https://api.example.com/v1',
  model: 'example-model',
  apiKeyPersistence: 'session' as const,
  targetLanguage: 'zh-CN',
  displayMode: 'bilingual' as const,
  customSystemPrompt: '',
};
const request = {
  sourceLanguage: 'auto',
  targetLanguage: 'zh-CN',
  blocks: [{ id: 'one', text: 'One source paragraph.' }],
};
const today = {
  date: '2026-08-18',
  currency: 'USD' as const,
  inputTokens: 0,
  outputTokens: 0,
  actualCost: 0,
  estimatedCost: 0,
  totalCost: 0,
  hasActualUsage: false,
  hasEstimatedUsage: false,
  budgetEnabled: false,
  dailyBudget: 0,
  budgetPercentage: 0,
  notifiedThresholds: [],
};

describe('cost service actual usage ledger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.maintainUsageLedger.mockResolvedValue(undefined);
    mocks.getTodayUsage.mockResolvedValue(today);
    mocks.recordUsage.mockResolvedValue({ today, crossedThresholds: [] });
  });

  it('records Provider-returned usage', async () => {
    const result = await settleTranslation(
      providerSettings,
      request,
      'Translate safely.',
      { inputTokens: 120, outputTokens: 40, kind: 'actual' },
    );

    expect(mocks.recordUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        usage: { inputTokens: 120, outputTokens: 40, kind: 'actual' },
        isEstimate: false,
      }),
      expect.any(Object),
    );
    expect(result.cost.isLedgerRecorded).toBe(true);
  });

  it('returns an estimate but does not add it to token history when usage is missing', async () => {
    const result = await settleTranslation(
      providerSettings,
      request,
      'Translate safely.',
      undefined,
    );

    expect(result.usage.kind).toBe('estimated');
    expect(mocks.recordUsage).not.toHaveBeenCalled();
    expect(result.cost.isLedgerRecorded).toBe(false);
    expect(result.cost.today).toEqual(today);
  });
});
