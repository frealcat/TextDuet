import type {
  OperationResult,
  ProviderSettings,
  PublicProviderSettings,
  RuntimeMessage,
  TranslationBatchResponse,
  TranslationEstimateResponse,
} from '@/src/core/contracts';
import {
  parseCompatibilityPageSnapshot,
  parseConfiguredProviderSettings,
  parsePageTranslationState,
  parseProviderSettings,
  parseRuntimeMessage,
} from '@/src/core/schemas';
import { createCompatibilityDiagnostic } from '@/src/core/compatibility-diagnostics';
import {
  estimateTranslationWithCache,
  translateWithCache,
} from '@/src/background/translation-service';
import { OpenAiCompatibleProvider } from '@/src/providers/openai-compatible';
import {
  getApiKey,
  providerSettingsStorage,
  saveApiKey,
} from '@/src/storage/settings';
import {
  clearCostUsage,
  getLocalUsageHistory,
  getCostDashboard,
  saveCostSettings,
} from '@/src/storage/cost-service';
import { fetchOfficialModelPricing } from '@/src/providers/official-pricing';
import { fetchProviderBalance } from '@/src/providers/provider-balance';
import {
  clearTranslationCache,
  createUnavailableTranslationCacheDashboard,
  getTranslationCacheDashboard,
} from '@/src/storage/translation-cache';

const provider = new OpenAiCompatibleProvider();
const requestControllersByTab = new Map<number, AbortController>();
const LAST_TRANSLATED_TAB_ID_KEY = 'textduet:last-translated-tab-id';

export default defineBackground(() => {
  void restrictStorageAccess();
  browser.tabs.onRemoved.addListener((tabId) => {
    abortTabTranslation(tabId);
    void clearLastTranslatedTab(tabId);
  });

  browser.runtime.onMessage.addListener((rawMessage, sender, sendResponse) => {
    Promise.resolve(rawMessage)
      .then(parseRuntimeMessage)
      .then((message) => handleMessage(message, sender))
      .then(sendResponse)
      .catch((error: unknown) => {
        sendResponse({
          ok: false,
          message: error instanceof Error ? error.message : '发生未知错误',
        } satisfies OperationResult);
      });

    return true;
  });
});

async function handleMessage(
  message: RuntimeMessage,
  sender: Browser.runtime.MessageSender,
): Promise<unknown> {
  switch (message.type) {
    case 'GET_PROVIDER_SETTINGS':
      assertTrustedExtensionSender(sender);
      return getPublicProviderSettings();

    case 'GET_COST_DASHBOARD': {
      assertTrustedExtensionSender(sender);
      const settings = parseProviderSettings(await providerSettingsStorage.getValue());
      return getCostDashboard(settings.model);
    }

    case 'GET_USAGE_HISTORY':
      assertTrustedExtensionSender(sender);
      return getLocalUsageHistory();

    case 'GET_PROVIDER_BALANCE': {
      assertTrustedExtensionSender(sender);
      const settings = parseConfiguredProviderSettings(
        await providerSettingsStorage.getValue(),
      );
      const apiKey = await getApiKey(settings.apiKeyPersistence);
      return fetchProviderBalance(settings, apiKey);
    }

    case 'REFRESH_PROVIDER_PRICING': {
      assertTrustedExtensionSender(sender);
      return fetchOfficialModelPricing(message.baseUrl, message.model);
    }

    case 'GET_TRANSLATION_CACHE_DASHBOARD':
      assertTrustedExtensionSender(sender);
      return getTranslationCacheDashboard().catch(
        createUnavailableTranslationCacheDashboard,
      );

    case 'GET_COMPATIBILITY_DIAGNOSTIC':
      assertTrustedExtensionSender(sender);
      return createPageCompatibilityDiagnostic(message.includePath);

    case 'SAVE_COST_SETTINGS':
      assertTrustedExtensionSender(sender);
      await saveCostSettings(message.settings);
      return { ok: true, message: '成本与预算配置已保存' } satisfies OperationResult;

    case 'CLEAR_USAGE_LEDGER':
      assertTrustedExtensionSender(sender);
      await clearCostUsage();
      return { ok: true, message: '本地用量记录已清空' } satisfies OperationResult;

    case 'CLEAR_TRANSLATION_CACHE':
      assertTrustedExtensionSender(sender);
      await clearTranslationCache();
      return { ok: true, message: '本地翻译缓存已清空' } satisfies OperationResult;

    case 'SAVE_PROVIDER_SETTINGS':
      assertTrustedExtensionSender(sender);
      return saveProviderSettings(message.settings, message.apiKey);

    case 'TEST_PROVIDER':
      assertTrustedExtensionSender(sender);
      return testProvider();

    case 'TRANSLATE_ACTIVE_TAB':
      assertTrustedExtensionSender(sender);
      return startActiveTabTranslation(message.targetLanguage);

    case 'STOP_ACTIVE_TAB':
      assertTrustedExtensionSender(sender);
      return stopActiveTabTranslation();

    case 'GET_ACTIVE_TAB_TRANSLATION_STATE':
      assertTrustedExtensionSender(sender);
      return getActiveTabTranslationState();

    case 'SET_ACTIVE_TAB_DISPLAY_MODE':
      assertTrustedExtensionSender(sender);
      return setActiveTabDisplayMode(message.displayMode);

    case 'SET_ACTIVE_MODEL':
      assertTrustedExtensionSender(sender);
      return setActiveModel(message.model);

    case 'ESTIMATE_TRANSLATION':
      assertTabSender(sender);
      return estimateTranslationRequest(message.request);

    case 'TRANSLATE_BATCH':
      return translateBatch(message.request, assertTabSender(sender));

    default:
      throw new Error('不支持的扩展消息');
  }
}

async function getPublicProviderSettings(): Promise<PublicProviderSettings> {
  const settings = parseProviderSettings(await providerSettingsStorage.getValue());
  const apiKey = await getApiKey(settings.apiKeyPersistence);
  return { ...settings, hasApiKey: Boolean(apiKey) };
}

async function saveProviderSettings(
  settings: ProviderSettings,
  apiKey?: string,
): Promise<OperationResult> {
  const validatedSettings = parseConfiguredProviderSettings(settings);
  await providerSettingsStorage.setValue(validatedSettings);

  if (apiKey?.trim()) {
    await saveApiKey(apiKey.trim(), validatedSettings.apiKeyPersistence);
  }

  return { ok: true, message: '配置已保存' };
}

async function testProvider(): Promise<OperationResult> {
  const settings = parseConfiguredProviderSettings(await providerSettingsStorage.getValue());
  const apiKey = await getApiKey(settings.apiKeyPersistence);
  await provider.testConnection(settings, apiKey);
  return { ok: true, message: '连接成功，模型已返回测试翻译' };
}

async function translateBatch(
  request: Extract<RuntimeMessage, { type: 'TRANSLATE_BATCH' }>['request'],
  tabId: number,
): Promise<TranslationBatchResponse> {
  abortTabTranslation(tabId);
  const controller = new AbortController();
  requestControllersByTab.set(tabId, controller);

  try {
    return await translateWithCache(provider, request, controller.signal);
  } finally {
    if (requestControllersByTab.get(tabId) === controller) {
      requestControllersByTab.delete(tabId);
    }
  }
}

async function estimateTranslationRequest(
  request: Extract<RuntimeMessage, { type: 'ESTIMATE_TRANSLATION' }>['request'],
): Promise<TranslationEstimateResponse> {
  return estimateTranslationWithCache(request);
}

async function startActiveTabTranslation(targetLanguage: string): Promise<OperationResult> {
  const tab = await getActiveTab();
  const settings = parseConfiguredProviderSettings(await providerSettingsStorage.getValue());
  abortTabTranslation(tab.id);
  await browser.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['/translator.js'],
  });
  const previousState = await browser.tabs
    .sendMessage(tab.id, { type: 'GET_TRANSLATION_STATE' } satisfies RuntimeMessage)
    .then(parsePageTranslationState)
    .catch(() => ({ state: 'idle', hasRun: false } as const));
  await browser.tabs.sendMessage(tab.id, {
    type: 'START_PAGE_TRANSLATION',
    targetLanguage,
    displayMode: settings.displayMode,
    translationColor: settings.translationColor,
    forceRefresh: previousState.hasRun,
  } satisfies RuntimeMessage);
  await browser.storage.session
    .set({ [LAST_TRANSLATED_TAB_ID_KEY]: tab.id })
    .catch(() => undefined);

  return { ok: true, message: '已开始翻译当前网页' };
}

async function getActiveTabTranslationState() {
  try {
    const tab = await getActiveTab();
    const rawState = await browser.tabs.sendMessage(tab.id, {
      type: 'GET_TRANSLATION_STATE',
    } satisfies RuntimeMessage);
    return parsePageTranslationState(rawState);
  } catch {
    return { state: 'idle', hasRun: false } as const;
  }
}

async function setActiveTabDisplayMode(
  displayMode: ProviderSettings['displayMode'],
): Promise<OperationResult> {
  const tab = await getActiveTab();
  await browser.tabs.sendMessage(tab.id, {
    type: 'SET_PAGE_DISPLAY_MODE',
    displayMode,
  } satisfies RuntimeMessage);
  const settings = parseProviderSettings(await providerSettingsStorage.getValue());
  await providerSettingsStorage.setValue({ ...settings, displayMode });
  const message = displayMode === 'bilingual'
    ? '已显示原文与译文'
    : displayMode === 'source-only'
      ? '已只显示原文'
      : '已只显示译文';
  return { ok: true, message };
}

async function setActiveModel(model: string): Promise<OperationResult> {
  const settings = parseProviderSettings(await providerSettingsStorage.getValue());
  const normalizedModel = model.trim();
  const models = [...new Set([...(settings.models || []), normalizedModel])];
  await providerSettingsStorage.setValue({ ...settings, model: normalizedModel, models });
  return { ok: true, message: `已切换模型：${normalizedModel}` };
}

async function stopActiveTabTranslation(): Promise<OperationResult> {
  const tab = await getActiveTab();
  abortTabTranslation(tab.id);
  await browser.tabs
    .sendMessage(tab.id, { type: 'STOP_PAGE_TRANSLATION' } satisfies RuntimeMessage)
    .catch(() => undefined);
  return { ok: true, message: '已停止翻译' };
}

async function getActiveTab(): Promise<{ id: number }> {
  const tab = await getActiveTabDetails();
  return { id: tab.id };
}

async function createPageCompatibilityDiagnostic(includePath: boolean) {
  const tab = await getLastTranslatedTabDetails();
  const rawSnapshot = await browser.tabs.sendMessage(tab.id, {
    type: 'GET_TRANSLATION_DIAGNOSTIC',
  } satisfies RuntimeMessage);
  const snapshot = parseCompatibilityPageSnapshot(rawSnapshot);
  if (!snapshot.hasRun) {
    throw new Error('请先在当前网页启动翻译，再生成诊断包');
  }

  const url = new URL(tab.url);
  const chromeVersion = /Chrome\/([\d.]+)/.exec(navigator.userAgent)?.[1] || 'unknown';
  return createCompatibilityDiagnostic({
    generatedAt: new Date().toISOString(),
    extensionVersion: browser.runtime.getManifest().version,
    chromeVersion,
    hostname: url.hostname,
    pathname: url.pathname,
    includePath,
    candidateCount: snapshot.candidateCount,
    translatedCount: snapshot.translatedCount,
    failedBatchCount: snapshot.failedBatchCount,
    issueType: 'other',
    screenshotIncluded: false,
  });
}

async function getLastTranslatedTabDetails(): Promise<{ id: number; url: string }> {
  const stored = await browser.storage.session.get(LAST_TRANSLATED_TAB_ID_KEY);
  const tabId = stored[LAST_TRANSLATED_TAB_ID_KEY];
  if (!Number.isInteger(tabId) || (tabId as number) < 0) {
    throw new Error('请先在目标网页启动翻译，再生成诊断包');
  }

  const tab = await browser.tabs.get(tabId as number).catch(() => undefined);
  if (!tab?.id || !tab.url?.startsWith('http://') && !tab?.url?.startsWith('https://')) {
    throw new Error('最近翻译的网页已关闭或无法访问，请重新启动翻译');
  }
  return { id: tab.id, url: tab.url };
}

async function getActiveTabDetails(): Promise<{ id: number; url: string }> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    throw new Error('无法访问当前标签页');
  }
  if (!tab.url?.startsWith('http://') && !tab.url?.startsWith('https://')) {
    throw new Error('浏览器内部页面不支持翻译');
  }
  return { id: tab.id, url: tab.url };
}

function assertTabSender(sender: Browser.runtime.MessageSender): number {
  if (!sender.tab?.id) {
    throw new Error('翻译请求必须来自网页内容脚本');
  }
  return sender.tab.id;
}

function assertTrustedExtensionSender(sender: Browser.runtime.MessageSender): void {
  const extensionOrigin = new URL(browser.runtime.getURL('/')).origin;
  const senderOrigin = sender.url ? new URL(sender.url).origin : undefined;
  if (sender.id !== browser.runtime.id || senderOrigin !== extensionOrigin) {
    throw new Error('该操作只能从扩展设置或弹窗发起');
  }
}

function abortTabTranslation(tabId: number): void {
  requestControllersByTab.get(tabId)?.abort();
  requestControllersByTab.delete(tabId);
}

async function clearLastTranslatedTab(tabId: number): Promise<void> {
  const stored = await browser.storage.session.get(LAST_TRANSLATED_TAB_ID_KEY);
  if (stored[LAST_TRANSLATED_TAB_ID_KEY] === tabId) {
    await browser.storage.session.remove(LAST_TRANSLATED_TAB_ID_KEY);
  }
}

async function restrictStorageAccess(): Promise<void> {
  const localStorage = browser.storage.local as typeof browser.storage.local & {
    setAccessLevel?: (options: { accessLevel: 'TRUSTED_CONTEXTS' }) => Promise<void>;
  };
  const sessionStorage = browser.storage.session as typeof browser.storage.session & {
    setAccessLevel?: (options: { accessLevel: 'TRUSTED_CONTEXTS' }) => Promise<void>;
  };

  await Promise.all([
    localStorage.setAccessLevel?.({ accessLevel: 'TRUSTED_CONTEXTS' }),
    sessionStorage.setAccessLevel?.({ accessLevel: 'TRUSTED_CONTEXTS' }),
  ]);
}
