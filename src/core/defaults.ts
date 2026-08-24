import type { CostSettings, ProviderSettings } from './contracts';

export const DEFAULT_TRANSLATION_COLOR = '#9c5e2e';
export const DEFAULT_SOURCE_LANGUAGE = 'auto';
export const DEFAULT_TARGET_LANGUAGE = 'system';
// The in-page shortcut is opt-in because it adds a control to arbitrary pages.
export const DEFAULT_SELECTION_QUICK_ACTION = false;

export const DEFAULT_PROVIDER_SETTINGS: ProviderSettings = {
  provider: 'openai-compatible',
  baseUrl: 'https://api.openai.com/v1',
  model: '',
  models: [],
  apiKeyPersistence: 'session',
  targetLanguage: DEFAULT_TARGET_LANGUAGE,
  sourceLanguage: DEFAULT_SOURCE_LANGUAGE,
  selectionQuickAction: DEFAULT_SELECTION_QUICK_ACTION,
  displayMode: 'bilingual',
  translationColor: DEFAULT_TRANSLATION_COLOR,
  customSystemPrompt: '',
};

export const DEFAULT_COST_SETTINGS: CostSettings = {
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
  budget: {
    enabled: false,
    dailyLimit: 0,
  },
};

export const BUDGET_THRESHOLDS = [50, 80, 100] as const;

export const PROVIDER_PRESETS = [
  {
    id: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    modelPlaceholder: '例如：gpt-4.1-mini',
  },
  {
    id: 'qwen',
    label: '阿里云百炼 Qwen',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    modelPlaceholder: '例如：qwen-plus',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    modelPlaceholder: '例如：deepseek-chat',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    modelPlaceholder: '例如：openai/gpt-4.1-mini',
  },
  {
    id: 'siliconflow',
    label: '硅基流动',
    baseUrl: 'https://api.siliconflow.cn/v1',
    modelPlaceholder: '例如：Qwen/Qwen3-8B',
  },
] as const;

export const SUPPORTED_TARGET_LANGUAGES = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'zh-TW', label: '繁體中文' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'es', label: 'Español' },
] as const;

export const SUPPORTED_SOURCE_LANGUAGES = [
  { value: 'auto', label: '自动检测' },
  ...SUPPORTED_TARGET_LANGUAGES,
] as const;

export function resolveSystemLanguage(language = getBrowserLanguage()): string {
  const normalized = language.toLowerCase().replace('_', '-');
  const family = normalized.split('-')[0];
  if (family === 'zh') return normalized.startsWith('zh-tw') || normalized.startsWith('zh-hk') ? 'zh-TW' : 'zh-CN';
  return SUPPORTED_TARGET_LANGUAGES.find(({ value }) => value.toLowerCase() === family)?.value || 'en';
}

export function resolveTargetLanguage(value: string): string {
  return value === DEFAULT_TARGET_LANGUAGE ? resolveSystemLanguage() : value;
}

export function normalizeProviderLanguagePreferences<T extends {
  sourceLanguage?: string;
  targetLanguage: string;
}>(settings: T): T & { sourceLanguage: string; targetLanguage: string } {
  return {
    ...settings,
    sourceLanguage: settings.sourceLanguage || DEFAULT_SOURCE_LANGUAGE,
    targetLanguage: settings.targetLanguage || DEFAULT_TARGET_LANGUAGE,
  };
}

function getBrowserLanguage(): string {
  return typeof navigator !== 'undefined' ? navigator.language || 'en' : 'en';
}
