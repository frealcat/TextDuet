import * as z from 'zod/mini';
import { isSupportedTranslationColor } from './translation-colors';

const LANGUAGE_CODE_MAX_LENGTH = 64;
const MODEL_NAME_MAX_LENGTH = 256;
const BLOCK_ID_MAX_LENGTH = 128;
const SOURCE_TEXT_MAX_LENGTH = 4_000;
const TRANSLATED_TEXT_MAX_LENGTH = 16_000;
const MAX_BLOCKS_PER_BATCH = 200;
const MAX_MONEY_AMOUNT = 1_000_000_000;
const MAX_MODEL_OPTIONS = 50;
const SourceLanguagePreferenceSchema = z.string().check(z.trim(), z.minLength(1), z.maxLength(LANGUAGE_CODE_MAX_LENGTH));
const TargetLanguagePreferenceSchema = z.string().check(z.trim(), z.minLength(1), z.maxLength(LANGUAGE_CODE_MAX_LENGTH));

const NonNegativeMoneySchema = z.number().check(
  z.nonnegative(),
  z.maximum(MAX_MONEY_AMOUNT),
);
const TokenCountSchema = z.int().check(z.nonnegative(), z.maximum(1_000_000_000));
const AggregateTokenCountSchema = z.int().check(
  z.nonnegative(),
  z.maximum(Number.MAX_SAFE_INTEGER),
);
const CurrencySchema = z.enum(['USD', 'CNY', 'EUR']);
const LocalDateSchema = z.string().check(z.regex(/^\d{4}-\d{2}-\d{2}$/));
const BudgetThresholdSchema = z.union([z.literal(50), z.literal(80), z.literal(100)]);
const BalanceAmountSchema = z.string().check(
  z.minLength(1),
  z.maxLength(64),
  z.regex(/^(?:0|[1-9]\d*)(?:\.\d+)?$/),
);

const HttpsUrlSchema = z.string().check(
  z.trim(),
  z.maxLength(2_048),
  z.refine((value) => {
    try {
      return new URL(value).protocol === 'https:';
    } catch {
      return false;
    }
  }, { error: 'API 地址必须是有效的 HTTPS URL' }),
);

const CssColorSchema = z.string().check(
  z.trim(),
  z.maxLength(64),
  z.refine(isSupportedTranslationColor, {
    error: '译文颜色必须是 # 十六进制或 rgb/rgba 格式',
  }),
);

export const ProviderSettingsSchema = z.strictObject({
  provider: z.literal('openai-compatible'),
  baseUrl: HttpsUrlSchema,
  model: z.string().check(z.trim(), z.maxLength(MODEL_NAME_MAX_LENGTH)),
  models: z.optional(z.array(
    z.string().check(z.trim(), z.minLength(1), z.maxLength(MODEL_NAME_MAX_LENGTH)),
  ).check(
    z.maxLength(MAX_MODEL_OPTIONS),
    z.refine((models) => new Set(models).size === models.length, {
      error: '模型列表不能包含重复项',
    }),
  )),
  modelByOrigin: z.optional(z.record(
    z.string().check(z.minLength(1), z.maxLength(2048)),
    z.string().check(z.trim(), z.minLength(1), z.maxLength(MODEL_NAME_MAX_LENGTH)),
  )),
  modelsByOrigin: z.optional(z.record(
    z.string().check(z.minLength(1), z.maxLength(2048)),
    z.array(
      z.string().check(z.trim(), z.minLength(1), z.maxLength(MODEL_NAME_MAX_LENGTH)),
    ).check(
      z.maxLength(MAX_MODEL_OPTIONS),
      z.refine((models) => new Set(models).size === models.length, {
        error: '模型列表不能包含重复项',
      }),
    ),
  )),
  apiKeyPersistence: z.enum(['session', 'local']),
  targetLanguage: z
    .string()
    .check(z.trim(), z.minLength(1), z.maxLength(LANGUAGE_CODE_MAX_LENGTH)),
  sourceLanguage: z.optional(SourceLanguagePreferenceSchema),
  selectionQuickAction: z.optional(z.boolean()),
  headerPopupRescan: z.optional(z.boolean()),
  language: z.optional(z.enum(['auto', 'zh-CN', 'en'])),
  displayMode: z.enum(['bilingual', 'source-only', 'translated-only']),
  translationColor: z.optional(CssColorSchema),
  customSystemPrompt: z.string().check(z.maxLength(12_000)),
});

export const ConfiguredProviderSettingsSchema = ProviderSettingsSchema.check(
  z.refine((settings) => settings.model.length > 0, {
    path: ['model'],
    error: '模型名称不能为空',
  }),
);

export const TranslationBlockSchema = z.strictObject({
  id: z.string().check(z.minLength(1), z.maxLength(BLOCK_ID_MAX_LENGTH)),
  text: z.string().check(z.minLength(2), z.maxLength(SOURCE_TEXT_MAX_LENGTH)),
  styleContext: z.optional(z.strictObject({
    sourceColor: CssColorSchema,
    preferredColor: CssColorSchema,
    backgroundColor: CssColorSchema,
    minimumContrast: z.number().check(z.minimum(1), z.maximum(21)),
    sourceContrast: z.number().check(z.minimum(1), z.maximum(21)),
    preferredContrast: z.number().check(z.minimum(1), z.maximum(21)),
  })),
});

export const TranslatedBlockSchema = z.strictObject({
  id: z.string().check(z.minLength(1), z.maxLength(BLOCK_ID_MAX_LENGTH)),
  translatedText: z
    .string()
    .check(z.minLength(1), z.maxLength(TRANSLATED_TEXT_MAX_LENGTH)),
  colorPreference: z.optional(z.enum(['preferred', 'source'])),
});

const TranslationBlocksSchema = z.array(TranslationBlockSchema).check(
  z.minLength(1),
  z.maxLength(MAX_BLOCKS_PER_BATCH),
  z.refine((blocks) => new Set(blocks.map((block) => block.id)).size === blocks.length),
);

export const TranslationBatchRequestSchema = z.strictObject({
  sourceLanguage: z
    .string()
    .check(z.trim(), z.minLength(1), z.maxLength(LANGUAGE_CODE_MAX_LENGTH)),
  targetLanguage: z
    .string()
    .check(z.trim(), z.minLength(1), z.maxLength(LANGUAGE_CODE_MAX_LENGTH)),
  forceRefresh: z.optional(z.boolean()),
  blocks: TranslationBlocksSchema,
});

export const PageTranslationStateSchema = z.strictObject({
  state: z.enum(['idle', 'progress', 'complete', 'stopped', 'empty', 'error']),
  hasRun: z.boolean(),
  message: z.optional(z.string().check(z.maxLength(2_000))),
});

export const ModelUsageSchema = z.strictObject({
  inputTokens: TokenCountSchema,
  outputTokens: TokenCountSchema,
  kind: z.enum(['actual', 'estimated', 'cached']),
});

export const TranslationCacheBatchSchema = z.strictObject({
  hitCount: z.int().check(z.nonnegative(), z.maximum(MAX_BLOCKS_PER_BATCH)),
  missCount: z.int().check(z.nonnegative(), z.maximum(MAX_BLOCKS_PER_BATCH)),
  isAvailable: z.boolean(),
});

export const TranslationCacheDashboardSchema = z.strictObject({
  entryCount: z.int().check(z.nonnegative()),
  sizeBytes: z.int().check(z.nonnegative()),
  maxSizeBytes: z.int().check(z.nonnegative()),
  ttlDays: z.int().check(z.positive()),
  isAvailable: z.boolean(),
});

export const CompatibilityPageSnapshotSchema = z.strictObject({
  candidateCount: z.int().check(z.nonnegative(), z.maximum(1_000_000)),
  translatedCount: z.int().check(z.nonnegative(), z.maximum(1_000_000)),
  failedBatchCount: z.int().check(z.nonnegative(), z.maximum(1_000_000)),
  hasRun: z.boolean(),
});

export const CompatibilityDiagnosticSchema = z.strictObject({
  schemaVersion: z.literal(1),
  generatedAt: z.string().check(z.minLength(1), z.maxLength(64)),
  extensionVersion: z.string().check(z.minLength(1), z.maxLength(64)),
  chromeVersion: z.string().check(z.minLength(1), z.maxLength(64)),
  page: z.strictObject({
    hostname: z.string().check(z.minLength(1), z.maxLength(253)),
    pathname: z.optional(z.string().check(z.minLength(1), z.maxLength(1_024))),
  }),
  metrics: z.strictObject({
    candidateCount: z.int().check(z.nonnegative(), z.maximum(1_000_000)),
    translatedCount: z.int().check(z.nonnegative(), z.maximum(1_000_000)),
    failedBatchCount: z.int().check(z.nonnegative(), z.maximum(1_000_000)),
  }),
  issue: z.strictObject({
    type: z.enum([
      'missed-content',
      'wrong-content',
      'duplicate-translation',
      'layout',
      'dynamic-content',
      'performance',
      'other',
    ]),
    errorCode: z.optional(z.string().check(z.minLength(1), z.maxLength(64))),
  }),
  screenshotIncluded: z.literal(false),
});

export const CostPriceSchema = z.strictObject({
  enabled: z.boolean(),
  model: z.string().check(z.trim(), z.maxLength(MODEL_NAME_MAX_LENGTH)),
  currency: CurrencySchema,
  inputPerMillion: NonNegativeMoneySchema,
  outputPerMillion: NonNegativeMoneySchema,
  updatedAt: LocalDateSchema,
  source: z.enum(['user', 'built-in']),
});

export const CostSettingsSchema = z
  .strictObject({
    version: z.literal(1),
    price: CostPriceSchema,
    budget: z.strictObject({
      enabled: z.boolean(),
      dailyLimit: NonNegativeMoneySchema,
    }),
  })
  .check(
    z.refine((settings) => !settings.budget.enabled || settings.budget.dailyLimit > 0, {
      path: ['budget', 'dailyLimit'],
      error: '启用每日预算时，预算金额必须大于 0',
    }),
  );

export const CostEstimateSchema = z.strictObject({
  inputTokens: TokenCountSchema,
  outputTokensMin: TokenCountSchema,
  outputTokensMax: TokenCountSchema,
  currency: CurrencySchema,
  costMin: NonNegativeMoneySchema,
  costMax: NonNegativeMoneySchema,
  isPriceConfigured: z.boolean(),
});

export const TodayUsageSummarySchema = z.strictObject({
  date: LocalDateSchema,
  currency: CurrencySchema,
  inputTokens: TokenCountSchema,
  outputTokens: TokenCountSchema,
  actualCost: NonNegativeMoneySchema,
  estimatedCost: NonNegativeMoneySchema,
  totalCost: NonNegativeMoneySchema,
  hasActualUsage: z.boolean(),
  hasEstimatedUsage: z.boolean(),
  budgetEnabled: z.boolean(),
  dailyBudget: NonNegativeMoneySchema,
  budgetPercentage: NonNegativeMoneySchema,
  notifiedThresholds: z.array(BudgetThresholdSchema).check(z.maxLength(3)),
});

export const UsageHistoryPointSchema = z.strictObject({
  date: LocalDateSchema,
  inputTokens: AggregateTokenCountSchema,
  outputTokens: AggregateTokenCountSchema,
  hasEstimatedUsage: z.boolean(),
});

export const UsageModelSeriesSchema = z.strictObject({
  provider: z.literal('openai-compatible'),
  model: z.string().check(z.trim(), z.minLength(1), z.maxLength(MODEL_NAME_MAX_LENGTH)),
  points: z.array(UsageHistoryPointSchema).check(z.maxLength(90)),
  totalInputTokens: AggregateTokenCountSchema,
  totalOutputTokens: AggregateTokenCountSchema,
  hasEstimatedUsage: z.boolean(),
});

export const UsageHistoryDashboardSchema = z
  .strictObject({
    days: z.int().check(z.positive(), z.maximum(90)),
    points: z.array(UsageHistoryPointSchema).check(z.maxLength(90)),
    totalInputTokens: AggregateTokenCountSchema,
    totalOutputTokens: AggregateTokenCountSchema,
    hasEstimatedUsage: z.boolean(),
    models: z.array(UsageModelSeriesSchema).check(z.maxLength(200)),
    isLedgerAvailable: z.boolean(),
    source: z.literal('local'),
  })
  .check(
    z.refine(
      (dashboard) => dashboard.points.length === dashboard.days
        && dashboard.models.every((series) => series.points.length === dashboard.days),
    ),
  );

export const OfficialModelPricingSchema = z.discriminatedUnion('status', [
  z.strictObject({ status: z.literal('unavailable') }),
  z.strictObject({
    status: z.literal('available'),
    providerLabel: z.string().check(z.trim(), z.minLength(1), z.maxLength(128)),
    model: z.string().check(z.trim(), z.minLength(1), z.maxLength(MODEL_NAME_MAX_LENGTH)),
    currency: z.literal('USD'),
    inputPerMillion: NonNegativeMoneySchema,
    outputPerMillion: NonNegativeMoneySchema,
    checkedAt: LocalDateSchema,
    sourceUrl: HttpsUrlSchema,
  }),
]);

export const ProviderBalanceSchema = z.discriminatedUnion('status', [
  z.strictObject({ status: z.literal('unsupported') }),
  z.strictObject({
    status: z.literal('available'),
    providerLabel: z.literal('DeepSeek'),
    isAvailable: z.boolean(),
    balances: z.array(z.strictObject({
      currency: z.enum(['CNY', 'USD']),
      totalBalance: BalanceAmountSchema,
      grantedBalance: BalanceAmountSchema,
      toppedUpBalance: BalanceAmountSchema,
    })).check(z.minLength(1), z.maxLength(2)),
    checkedAt: LocalDateSchema,
    sourceUrl: HttpsUrlSchema,
  }),
]);

export const CostSettlementSchema = z.strictObject({
  currency: CurrencySchema,
  amount: NonNegativeMoneySchema,
  isEstimate: z.boolean(),
  today: TodayUsageSummarySchema,
  crossedThresholds: z.array(BudgetThresholdSchema).check(z.maxLength(3)),
  isLedgerRecorded: z.boolean(),
});

export const TranslationBatchResponseSchema = z.strictObject({
  blocks: z
    .array(TranslatedBlockSchema)
    .check(z.minLength(1), z.maxLength(MAX_BLOCKS_PER_BATCH)),
  model: z.string().check(z.minLength(1), z.maxLength(MODEL_NAME_MAX_LENGTH)),
  usage: ModelUsageSchema,
  cost: CostSettlementSchema,
  cache: TranslationCacheBatchSchema,
});

export const TranslationStreamEventSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('TRANSLATION_BLOCK'), block: TranslatedBlockSchema }),
  z.strictObject({ type: z.literal('TRANSLATION_COMPLETE'), response: TranslationBatchResponseSchema }),
  z.strictObject({ type: z.literal('TRANSLATION_ERROR'), message: z.string().check(z.maxLength(2_000)) }),
]);

export const TranslationEstimateResponseSchema = z.strictObject({
  estimate: CostEstimateSchema,
  today: TodayUsageSummarySchema,
  isLedgerAvailable: z.boolean(),
  cache: TranslationCacheBatchSchema,
});

export const CostDashboardSchema = z.strictObject({
  settings: CostSettingsSchema,
  today: TodayUsageSummarySchema,
  isPriceForCurrentModel: z.boolean(),
  isLedgerAvailable: z.boolean(),
});

export const PublicProviderSettingsSchema = z.strictObject({
  ...ProviderSettingsSchema.shape,
  hasApiKey: z.boolean(),
});

export const OperationResultSchema = z.strictObject({
  ok: z.boolean(),
  message: z.optional(z.string().check(z.maxLength(2_000))),
});

export const RuntimeMessageSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('GET_PROVIDER_SETTINGS') }),
  z.strictObject({ type: z.literal('GET_COST_DASHBOARD') }),
  z.strictObject({ type: z.literal('GET_USAGE_HISTORY') }),
  z.strictObject({ type: z.literal('GET_PROVIDER_BALANCE') }),
  z.strictObject({
    type: z.literal('REFRESH_PROVIDER_PRICING'),
    baseUrl: HttpsUrlSchema,
    model: z.string().check(z.trim(), z.maxLength(MODEL_NAME_MAX_LENGTH)),
  }),
  z.strictObject({ type: z.literal('GET_TRANSLATION_CACHE_DASHBOARD') }),
  z.strictObject({
    type: z.literal('GET_COMPATIBILITY_DIAGNOSTIC'),
    includePath: z.boolean(),
  }),
  z.strictObject({ type: z.literal('CLEAR_USAGE_LEDGER') }),
  z.strictObject({ type: z.literal('CLEAR_TRANSLATION_CACHE') }),
  z.strictObject({
    type: z.literal('SAVE_PROVIDER_SETTINGS'),
    settings: ConfiguredProviderSettingsSchema,
    apiKey: z.optional(z.string().check(z.trim(), z.minLength(1), z.maxLength(4_096))),
  }),
  z.strictObject({ type: z.literal('TEST_PROVIDER') }),
  z.strictObject({
    type: z.literal('SAVE_COST_SETTINGS'),
    settings: CostSettingsSchema,
  }),
  z.strictObject({
    type: z.literal('TRANSLATE_ACTIVE_TAB'),
    sourceLanguage: z.optional(SourceLanguagePreferenceSchema),
    targetLanguage: z
      .string()
      .check(z.trim(), z.minLength(1), z.maxLength(LANGUAGE_CODE_MAX_LENGTH)),
  }),
  z.strictObject({
    type: z.literal('SET_LANGUAGE_PREFERENCES'),
    sourceLanguage: SourceLanguagePreferenceSchema,
    targetLanguage: TargetLanguagePreferenceSchema,
  }),
  z.strictObject({
    type: z.literal('SET_SELECTION_QUICK_ACTION'),
    enabled: z.boolean(),
  }),
  z.strictObject({
    type: z.literal('CONFIGURE_SELECTION_QUICK_ACTION'),
    enabled: z.boolean(),
    sourceLanguage: z.optional(SourceLanguagePreferenceSchema),
    targetLanguage: z.optional(TargetLanguagePreferenceSchema),
    translationColor: z.optional(CssColorSchema),
  }),
  z.strictObject({ type: z.literal('STOP_ACTIVE_TAB') }),
  z.strictObject({ type: z.literal('GET_ACTIVE_TAB_TRANSLATION_STATE') }),
  z.strictObject({
    type: z.literal('SET_ACTIVE_TAB_DISPLAY_MODE'),
    displayMode: z.enum(['bilingual', 'source-only', 'translated-only']),
  }),
  z.strictObject({
    type: z.literal('SET_ACTIVE_MODEL'),
    model: z.string().check(z.trim(), z.minLength(1), z.maxLength(MODEL_NAME_MAX_LENGTH)),
  }),
  z.strictObject({
    type: z.literal('START_PAGE_TRANSLATION'),
    sourceLanguage: z.optional(SourceLanguagePreferenceSchema),
    targetLanguage: z
      .string()
      .check(z.trim(), z.minLength(1), z.maxLength(LANGUAGE_CODE_MAX_LENGTH)),
    displayMode: z.optional(z.enum(['bilingual', 'source-only', 'translated-only'])),
    translationColor: z.optional(CssColorSchema),
    selectionQuickAction: z.optional(z.boolean()),
    headerPopupRescan: z.optional(z.boolean()),
    forceRefresh: z.optional(z.boolean()),
  }),
  z.strictObject({ type: z.literal('STOP_PAGE_TRANSLATION') }),
  z.strictObject({
    type: z.literal('SET_PAGE_DISPLAY_MODE'),
    displayMode: z.enum(['bilingual', 'source-only', 'translated-only']),
  }),
  z.strictObject({ type: z.literal('GET_TRANSLATION_STATE') }),
  z.strictObject({ type: z.literal('GET_TRANSLATION_DIAGNOSTIC') }),
  z.strictObject({
    type: z.literal('ESTIMATE_TRANSLATION'),
    request: TranslationBatchRequestSchema,
  }),
  z.strictObject({
    type: z.literal('TRANSLATE_BATCH'),
    request: TranslationBatchRequestSchema,
  }),
  z.strictObject({
    type: z.literal('TRANSLATE_BATCH_STREAM'),
    request: TranslationBatchRequestSchema,
  }),
  z.strictObject({
    type: z.literal('TRANSLATE_SELECTION'),
    text: z.string().check(z.trim(), z.minLength(2), z.maxLength(16_000)),
    sourceLanguage: SourceLanguagePreferenceSchema,
    targetLanguage: TargetLanguagePreferenceSchema,
    frameId: z.optional(z.int().check(z.nonnegative())),
    translationColor: z.optional(CssColorSchema),
  }),
  z.strictObject({
    type: z.literal('REQUEST_SELECTION_TRANSLATION'),
    text: z.string().check(z.trim(), z.minLength(2), z.maxLength(16_000)),
    frameId: z.optional(z.int().check(z.nonnegative())),
  }),
]);

export type ProviderSettingsInput = z.input<typeof ProviderSettingsSchema>;

/** Parses an untrusted cross-context message without exposing schema internals. */
export function parseRuntimeMessage(value: unknown): z.infer<typeof RuntimeMessageSchema> {
  const result = RuntimeMessageSchema.safeParse(value);
  if (!result.success) {
    throw new Error('扩展消息格式无效');
  }
  return result.data;
}

/** Parses settings loaded from extension storage before they reach a Provider. */
export function parseProviderSettings(value: unknown): z.infer<typeof ProviderSettingsSchema> {
  const result = ProviderSettingsSchema.safeParse(value);
  if (!result.success) {
    throw new Error(result.error.issues[0]?.message || '模型配置格式无效');
  }
  return result.data;
}

/** Requires a complete Provider configuration before any paid network request. */
export function parseConfiguredProviderSettings(
  value: unknown,
): z.infer<typeof ProviderSettingsSchema> {
  const result = ConfiguredProviderSettingsSchema.safeParse(value);
  if (!result.success) {
    throw new Error(result.error.issues[0]?.message || '模型配置不完整');
  }
  return result.data;
}

/** Parses the public, redacted settings returned to extension pages. */
export function parsePublicProviderSettings(
  value: unknown,
): z.infer<typeof PublicProviderSettingsSchema> {
  const result = PublicProviderSettingsSchema.safeParse(value);
  if (!result.success) {
    throw new Error('扩展返回的配置格式无效');
  }
  return result.data;
}

/** Parses a standard operation response returned by the Service Worker. */
export function parseOperationResult(value: unknown): z.infer<typeof OperationResultSchema> {
  const result = OperationResultSchema.safeParse(value);
  if (!result.success) {
    throw new Error('扩展返回的操作结果格式无效');
  }
  return result.data;
}

/** Parses the current Translator Script state returned to the Popup. */
export function parsePageTranslationState(
  value: unknown,
): z.infer<typeof PageTranslationStateSchema> {
  const result = PageTranslationStateSchema.safeParse(value);
  if (!result.success) {
    throw new Error('扩展返回的翻译状态格式无效');
  }
  return result.data;
}

/** Parses a translated batch before it is rendered into an untrusted webpage. */
export function parseTranslationBatchResponse(
  value: unknown,
): z.infer<typeof TranslationBatchResponseSchema> {
  const result = TranslationBatchResponseSchema.safeParse(value);
  if (!result.success) {
    throw new Error('扩展返回的译文格式无效');
  }
  return result.data;
}

export function parseTranslationStreamEvent(value: unknown): z.infer<typeof TranslationStreamEventSchema> {
  const result = TranslationStreamEventSchema.safeParse(value);
  if (!result.success) throw new Error('扩展返回的流式译文格式无效');
  return result.data;
}

/** Parses cost settings loaded from storage or received from the trusted Options page. */
export function parseCostSettings(value: unknown): z.infer<typeof CostSettingsSchema> {
  const result = CostSettingsSchema.safeParse(value);
  if (!result.success) {
    throw new Error(result.error.issues[0]?.message || '成本配置格式无效');
  }
  return result.data;
}

/** Parses the complete public cost dashboard returned to extension pages. */
export function parseCostDashboard(value: unknown): z.infer<typeof CostDashboardSchema> {
  const result = CostDashboardSchema.safeParse(value);
  if (!result.success) {
    throw new Error('扩展返回的成本摘要格式无效');
  }
  return result.data;
}

/** Parses the local token history returned to extension pages. */
export function parseUsageHistoryDashboard(
  value: unknown,
): z.infer<typeof UsageHistoryDashboardSchema> {
  const result = UsageHistoryDashboardSchema.safeParse(value);
  if (!result.success) {
    throw new Error('扩展返回的用量历史格式无效');
  }
  return result.data;
}

/** Parses optional model pricing discovered from an official structured API. */
export function parseOfficialModelPricing(
  value: unknown,
): z.infer<typeof OfficialModelPricingSchema> {
  const result = OfficialModelPricingSchema.safeParse(value);
  if (!result.success) {
    throw new Error('扩展返回的官方价格格式无效');
  }
  return result.data;
}

/** Parses a redacted balance response before it reaches the trusted Options UI. */
export function parseProviderBalance(
  value: unknown,
): z.infer<typeof ProviderBalanceSchema> {
  const result = ProviderBalanceSchema.safeParse(value);
  if (!result.success) {
    throw new Error('扩展返回的余额格式无效');
  }
  return result.data;
}

/** Parses a local preflight estimate before any paid Provider request starts. */
export function parseTranslationEstimateResponse(
  value: unknown,
): z.infer<typeof TranslationEstimateResponseSchema> {
  const result = TranslationEstimateResponseSchema.safeParse(value);
  if (!result.success) {
    throw new Error('扩展返回的成本预估格式无效');
  }
  return result.data;
}

/** Parses the local cache summary returned to the trusted Options page. */
export function parseTranslationCacheDashboard(
  value: unknown,
): z.infer<typeof TranslationCacheDashboardSchema> {
  const result = TranslationCacheDashboardSchema.safeParse(value);
  if (!result.success) {
    throw new Error('扩展返回的缓存摘要格式无效');
  }
  return result.data;
}

/** Parses the redacted page counters returned by the Translator Script. */
export function parseCompatibilityPageSnapshot(
  value: unknown,
): z.infer<typeof CompatibilityPageSnapshotSchema> {
  const result = CompatibilityPageSnapshotSchema.safeParse(value);
  if (!result.success) {
    throw new Error('网页诊断计数格式无效');
  }
  return result.data;
}

/** Parses the local, redacted compatibility package before preview or download. */
export function parseCompatibilityDiagnostic(value: unknown): z.infer<typeof CompatibilityDiagnosticSchema> {
  const result = CompatibilityDiagnosticSchema.safeParse(value);
  if (!result.success) {
    throw new Error('扩展返回的诊断包格式无效');
  }
  return result.data;
}
