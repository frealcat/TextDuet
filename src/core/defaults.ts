import type { CostSettings, ProviderSettings } from './contracts';

export const DEFAULT_TRANSLATION_COLOR = '#9c5e2e';

export const DEFAULT_PROVIDER_SETTINGS: ProviderSettings = {
  provider: 'openai-compatible',
  baseUrl: 'https://api.openai.com/v1',
  model: '',
  models: [],
  apiKeyPersistence: 'session',
  targetLanguage: 'zh-CN',
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
