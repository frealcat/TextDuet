export interface PricingSource {
  id: string;
  providerLabel: string;
  url: string;
  checkedAt: string;
  note: string;
}

const PRICING_SOURCES: ReadonlyArray<PricingSource & { hostnames: readonly string[] }> = [
  {
    id: 'openai',
    providerLabel: 'OpenAI',
    url: 'https://openai.com/api/pricing/',
    checkedAt: '2026-08-17',
    note: '按实际模型与计费层级核对输入、缓存输入和输出价格。',
    hostnames: ['api.openai.com'],
  },
  {
    id: 'qwen',
    providerLabel: '阿里云百炼 Qwen',
    url: 'https://www.alibabacloud.com/help/en/model-studio/models',
    checkedAt: '2026-08-17',
    note: '按部署地域、模型版本和上下文区间核对价格；中国站可切换对应语言页面。',
    hostnames: ['dashscope.aliyuncs.com', 'dashscope-intl.aliyuncs.com'],
  },
  {
    id: 'deepseek',
    providerLabel: 'DeepSeek',
    url: 'https://api-docs.deepseek.com/quick_start/pricing-details',
    checkedAt: '2026-08-17',
    note: '按当前模型及缓存命中状态核对输入和输出价格。',
    hostnames: ['api.deepseek.com'],
  },
  {
    id: 'openrouter',
    providerLabel: 'OpenRouter',
    url: 'https://openrouter.ai/models',
    checkedAt: '2026-08-17',
    note: '在模型详情中核对价格；不同上游路由的计费可能不同。',
    hostnames: ['openrouter.ai'],
  },
  {
    id: 'siliconflow',
    providerLabel: '硅基流动',
    url: 'https://siliconflow.cn/pricing',
    checkedAt: '2026-08-17',
    note: '按当前模型名称核对价格，注意免费与付费模型的差异。',
    hostnames: ['api.siliconflow.cn'],
  },
];

export function getOfficialPricingSource(baseUrl: string): PricingSource | null {
  let hostname: string;
  try {
    const url = new URL(baseUrl);
    if (url.protocol !== 'https:') return null;
    hostname = url.hostname.toLowerCase();
  } catch {
    return null;
  }

  const source = PRICING_SOURCES.find(({ hostnames }) => hostnames.includes(hostname));
  if (!source) return null;

  const { hostnames: _hostnames, ...publicSource } = source;
  return publicSource;
}
