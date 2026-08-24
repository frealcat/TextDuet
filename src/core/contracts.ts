import type * as z from 'zod/mini';
import type {
  CostDashboardSchema,
  CostEstimateSchema,
  CostPriceSchema,
  CostSettingsSchema,
  CostSettlementSchema,
  CompatibilityPageSnapshotSchema,
  CompatibilityDiagnosticSchema,
  ModelUsageSchema,
  OfficialModelPricingSchema,
  ProviderBalanceSchema,
  OperationResultSchema,
  PageTranslationStateSchema,
  ProviderSettingsSchema,
  PublicProviderSettingsSchema,
  RuntimeMessageSchema,
  TranslatedBlockSchema,
  TranslationBatchRequestSchema,
  TranslationBatchResponseSchema,
  TranslationStreamEventSchema,
  TranslationEstimateResponseSchema,
  TranslationCacheBatchSchema,
  TranslationCacheDashboardSchema,
  TranslationBlockSchema,
  TodayUsageSummarySchema,
  UsageHistoryDashboardSchema,
  UsageModelSeriesSchema,
  UsageHistoryPointSchema,
} from './schemas';

export type ApiKeyPersistence = 'session' | 'local';
export type TranslationDisplayMode = 'bilingual' | 'source-only' | 'translated-only';
export type SourceLanguagePreference = 'auto' | string;
export type TargetLanguagePreference = 'system' | string;

export type ProviderSettings = z.infer<typeof ProviderSettingsSchema>;
export type TranslationBlock = z.infer<typeof TranslationBlockSchema>;
export type TranslatedBlock = z.infer<typeof TranslatedBlockSchema>;
export type TranslationBatchRequest = z.infer<typeof TranslationBatchRequestSchema>;
export type TranslationBatchResponse = z.infer<typeof TranslationBatchResponseSchema>;
export type PublicProviderSettings = z.infer<typeof PublicProviderSettingsSchema>;
export type OperationResult = z.infer<typeof OperationResultSchema>;
export type RuntimeMessage = z.infer<typeof RuntimeMessageSchema>;
export type ModelUsage = z.infer<typeof ModelUsageSchema>;
export type CostPrice = z.infer<typeof CostPriceSchema>;
export type CostSettings = z.infer<typeof CostSettingsSchema>;
export type CostEstimate = z.infer<typeof CostEstimateSchema>;
export type CostSettlement = z.infer<typeof CostSettlementSchema>;
export type TodayUsageSummary = z.infer<typeof TodayUsageSummarySchema>;
export type TranslationEstimateResponse = z.infer<typeof TranslationEstimateResponseSchema>;
export type CostDashboard = z.infer<typeof CostDashboardSchema>;
export type TranslationCacheBatch = z.infer<typeof TranslationCacheBatchSchema>;
export type TranslationCacheDashboard = z.infer<typeof TranslationCacheDashboardSchema>;
export type UsageHistoryPoint = z.infer<typeof UsageHistoryPointSchema>;
export type UsageHistoryDashboard = z.infer<typeof UsageHistoryDashboardSchema>;
export type UsageModelSeries = z.infer<typeof UsageModelSeriesSchema>;
export type OfficialModelPricing = z.infer<typeof OfficialModelPricingSchema>;
export type ProviderBalance = z.infer<typeof ProviderBalanceSchema>;
export type CompatibilityPageSnapshot = z.infer<typeof CompatibilityPageSnapshotSchema>;
export type CompatibilityDiagnostic = z.infer<typeof CompatibilityDiagnosticSchema>;
export type PageTranslationState = z.infer<typeof PageTranslationStateSchema>;
export type TranslationStreamEvent = z.infer<typeof TranslationStreamEventSchema>;
