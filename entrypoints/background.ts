import type {
  I18nBatchTranslationResult,
  OperationResult,
  ProviderSettings,
  PublicProviderSettings,
  RuntimeMessage,
  TranslationBatchResponse,
  TranslationEstimateResponse,
} from '@/src/core/contracts';
import {
  buildPublicProviderSettings,
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
  translateStreamWithCache,
} from '@/src/background/translation-service';
import { OpenAiCompatibleProvider } from '@/src/providers/openai-compatible';
import { requestFreeformCompletion, FreeformCompletionError } from '@/src/providers/freeform-completion';
import { buildI18nBatchPrompt } from '@/src/i18n/i18n-prompt';
import {
  getApiKey,
  clearVaultAndLegacySecrets,
  createVaultAndMigrate,
  unlockVaultAndMigrate,
  getVaultStatus,
  lockVault,
  migrateLegacySecrets,
  providerSettingsStorage,
  captureSecretLifecycleToken,
  saveApiKey,
  type SecretLifecycleToken,
} from '@/src/storage/settings';
import {
  VaultLockedError,
  VaultNotInitializedError,
} from '@/src/storage/vault';
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
import { normalizeProviderLanguagePreferences, resolveTargetLanguage } from '@/src/core/defaults';
import { hasCombinedProviderTransition, writeActiveModelToOriginCache } from '@/src/storage/provider-models';
import {
  confirmTranslationConsent,
  getTranslationConsent,
} from '@/src/storage/translation-consent';
import { createStorageReadiness } from '@/src/background/storage-readiness';
import { createStreamRequestController } from '@/src/background/stream-request-controller';
import { extractI18nTranslations } from '@/src/i18n/response';

const provider = new OpenAiCompatibleProvider();
const requestControllersByTab = new Map<number, Set<AbortController>>();
const LAST_TRANSLATED_TAB_ID_KEY = 'textduet:last-translated-tab-id';
const LAST_WEB_TAB_ID_KEY = 'textduet:last-web-tab-id';
const storageReadiness = createStorageReadiness(initializeStorageSecurity);

// ---- Stream port disconnect handling ----
//
// When a tab moves into the back/forward cache (bfcache) or navigates away
// mid-stream, Chrome closes the extension port. Subsequent postMessage calls
// on the dead port throw "The page keeping the extension port is moved into
// back/forward cache, so the message channel is closed." and surface as an
// `Unchecked runtime.lastError` warning because nothing checks it.
//
// We track disconnected ports in a WeakSet so a single in-flight postMessage
// does not spam the console, mark ports that completed cleanly so the
// matching onDisconnect stays silent, and emit one local diagnostic line per
// abnormal disconnect. The diagnostic is `console.warn` only, never written
// to storage or uploaded, and contains no user content, key, or query.

type StreamPortDisconnectReason = 'bfcache' | 'navigation' | 'clean';

const disconnectedStreamPorts = new WeakSet<Browser.runtime.Port>();
const completedStreamPorts = new WeakSet<Browser.runtime.Port>();

function logStreamPortDisconnect(
  port: Browser.runtime.Port,
  reason: Exclude<StreamPortDisconnectReason, 'clean'>,
  detail?: string,
): void {
  const payload: Record<string, string | number | null> = {
    event: 'textduet.stream-port.disconnect',
    portName: port.name,
    tabId: port.sender?.tab?.id ?? null,
    reason,
    at: new Date().toISOString(),
  };
  if (detail) payload.detail = detail.slice(0, 120);
  console.warn(`[textduet] ${JSON.stringify(payload)}`);
}

function safeStreamPostMessage(
  port: Browser.runtime.Port,
  message: Parameters<Browser.runtime.Port['postMessage']>[0],
): boolean {
  if (disconnectedStreamPorts.has(port)) return false;
  try {
    port.postMessage(message);
    if (message && typeof message === 'object' && 'type' in message) {
      const type = (message as { type?: unknown }).type;
      if (type === 'TRANSLATION_COMPLETE') completedStreamPorts.add(port);
    }
    return true;
  } catch (error) {
    disconnectedStreamPorts.add(port);
    const rawMessage = error instanceof Error ? error.message : String(error);
    const reason: Exclude<StreamPortDisconnectReason, 'clean'> = /back\/forward cache/i.test(
      rawMessage,
    )
      ? 'bfcache'
      : 'navigation';
    logStreamPortDisconnect(port, reason, rawMessage);
    return false;
  }
}

export default defineBackground(() => {
  // Start eagerly, while keeping failures retryable for the first user event.
  void storageReadiness.ensure().catch(() => undefined);
  void registerSelectionMenu();
  browser.contextMenus?.onClicked.addListener((info, tab) => {
    if (info.menuItemId !== 'textduet-translate-selection' || !tab?.id || !info.selectionText) return;
    // Context-menu events bypass runtime.onMessage, so explicitly wait for
    // storage hardening before reading settings or injecting the translator.
    void storageReadiness
      .ensure()
      .then(() => startSelectionTranslation(tab.id as number, info.frameId || 0, info.selectionText as string))
      .catch((error: unknown) => {
        console.warn('[textduet] selection translation skipped: storage is not ready', error);
      });
  });
  browser.tabs.onRemoved.addListener((tabId) => {
    abortTabTranslation(tabId);
    void storageReadiness
      .ensure()
      .then(() => Promise.all([clearLastTranslatedTab(tabId), clearLastWebTab(tabId)]))
      .catch((error: unknown) => {
        console.warn('[textduet] tab cleanup skipped: storage is not ready', error);
      });
  });
  browser.tabs.onActivated.addListener(({ tabId }) => {
    void storageReadiness
      .ensure()
      .then(() => rememberWebTab(tabId))
      .catch((error: unknown) => {
        console.warn('[textduet] active-tab bookkeeping skipped: storage is not ready', error);
      });
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
  browser.runtime.onConnect.addListener((port) => {
    if (port.name !== 'textduet-translation-stream') return;
    let tabId: number;
    try {
      tabId = assertTabSender(port.sender || {} as Browser.runtime.MessageSender);
    } catch {
      // Reject ports from extension pages, other extensions, and non-web
      // frames before registering a controller or accepting a request.
      try { port.disconnect(); } catch { /* already disconnected */ }
      return;
    }
    const requestController = createStreamRequestController();
    port.onMessage.addListener((rawMessage) => {
      if (requestController.isClosed()) return;
      if (rawMessage?.type !== 'TRANSLATE_BATCH_STREAM') return;
      try {
        assertTabSender(port.sender || {} as Browser.runtime.MessageSender);
      } catch {
        safeStreamPostMessage(port, { type: 'TRANSLATION_ERROR', message: '翻译请求必须来自网页内容脚本' });
        try { port.disconnect(); } catch { /* already disconnected */ }
        return;
      }
      const controller = requestController.start();
      if (!controller) {
        safeStreamPostMessage(port, { type: 'TRANSLATION_ERROR', message: '已有翻译请求正在进行' });
        return;
      }
      // A cleanly completed port may be reused. Clear the prior completion
      // marker so a later disconnect during this new request is diagnosed as
      // a lifecycle interruption instead of being mistaken for a clean close.
      completedStreamPorts.delete(port);
      // A port may be reused sequentially by a caller. Allocate and register
      // a fresh controller for each accepted request so STOP_ACTIVE_TAB can
      // cancel every request, including one sent after an earlier request's
      // finally block unregistered its controller.
      registerController(tabId, controller);
      void (async () => {
        try {
          await storageReadiness.ensure();
          const parsed = parseRuntimeMessage(rawMessage);
          if (parsed.type !== 'TRANSLATE_BATCH_STREAM') throw new Error('流式请求格式无效');
          // The Service Worker publishes only the fully validated response.
          // Sending individual provider chunks would let malformed streams
          // leave partial DOM output in the content script.
          const response = await translateStreamWithCache(provider, parsed.request, controller.signal, () => undefined);
          safeStreamPostMessage(port, { type: 'TRANSLATION_COMPLETE', response });
        } catch (error) {
          safeStreamPostMessage(port, {
            type: 'TRANSLATION_ERROR',
            message: error instanceof Error ? error.message : '网页翻译失败',
          });
        } finally {
          unregisterController(tabId, controller);
          requestController.finish(controller);
        }
      })();
    });
    port.onDisconnect.addListener(() => {
      const controller = requestController.close();
      controller?.abort();
      // A port can disconnect before it ever sends a request. Remove the
      // controller here as well as in the request's finally block so idle
      // ports do not retain tab-scoped cancellation state. unregister is
      // idempotent, which keeps the disconnect/completion race harmless.
      if (controller) unregisterController(tabId, controller);
      if (disconnectedStreamPorts.has(port)) return;
      if (completedStreamPorts.has(port)) {
        // Content script disconnected cleanly after a completed stream; no
        // diagnostic needed and nothing to do.
        disconnectedStreamPorts.add(port);
        return;
      }
      disconnectedStreamPorts.add(port);
      logStreamPortDisconnect(port, 'navigation');
    });
  });
});

async function handleMessage(
  message: RuntimeMessage,
  sender: Browser.runtime.MessageSender,
): Promise<unknown> {
  // CLEAR_VAULT is a destructive lifecycle boundary. Validate its sender and
  // advance the secret generation before waiting for one-time storage
  // hardening; otherwise a concurrent SAVE_PROVIDER_SETTINGS can remain in
  // its preflight await and enqueue a key write after the clear intent.
  if (message.type === 'CLEAR_VAULT') {
    assertTrustedExtensionSender(sender);
    const clearPromise = clearVaultAndLegacySecrets();
    const [readinessResult, secretResult, cacheResult] = await Promise.allSettled([
      storageReadiness.ensure(),
      clearPromise,
      clearTranslationCache(),
    ]);
    if (secretResult.status === 'rejected') throw secretResult.reason;
    if (readinessResult.status === 'rejected') throw readinessResult.reason;
    if (cacheResult.status === 'rejected') throw cacheResult.reason;
    return { exists: false, isUnlocked: false, version: null };
  }

  // Capture SAVE_PROVIDER_SETTINGS at message-entry time, before the shared
  // readiness gate. A save that is already waiting for initialization must be
  // invalidated when a later CLEAR_VAULT advances the lifecycle generation.
  const secretLifecycleToken = (
    message.type === 'SAVE_PROVIDER_SETTINGS'
    || message.type === 'CREATE_VAULT'
    || message.type === 'UNLOCK_VAULT'
    || message.type === 'LOCK_VAULT'
  )
    ? captureSecretLifecycleToken()
    : undefined;
  await storageReadiness.ensure();
  switch (message.type) {
    case 'GET_VAULT_STATUS':
      assertTrustedExtensionSender(sender);
      return getVaultStatus();

    case 'CREATE_VAULT': {
      assertTrustedExtensionSender(sender);
      const result = await createVaultAndMigrate(message.password, secretLifecycleToken);
      if (result.migration.discardedPersistentKeyCount > 0) {
        console.warn('[textduet] legacy persistent key data was discarded during vault creation');
      }
      return result.status;
    }

    case 'UNLOCK_VAULT': {
      assertTrustedExtensionSender(sender);
      const result = await unlockVaultAndMigrate(message.password, secretLifecycleToken);
      if (result.migration.discardedPersistentKeyCount > 0) {
        console.warn('[textduet] legacy persistent key data was discarded during vault unlock');
      }
      return result.status;
    }

    case 'LOCK_VAULT':
      assertTrustedExtensionSender(sender);
      return lockVault(secretLifecycleToken);

    case 'CLEAR_VAULT_CACHE':
      assertTrustedExtensionSender(sender);
      await clearTranslationCache();
      return { ok: true, message: '本地翻译缓存已清空' } satisfies OperationResult;

    case 'GET_TRANSLATION_CONSENT':
      assertTrustedExtensionSender(sender);
      return getTranslationConsent();

    case 'CONFIRM_TRANSLATION_CONSENT':
      assertTrustedExtensionSender(sender);
      return confirmTranslationConsent();

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
      const apiKey = await getApiKey(settings.apiKeyPersistence, settings.baseUrl, {
        apiKeyByOrigin: settings.apiKeyByOrigin,
      });
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
      return saveProviderSettings(message.settings, message.apiKey, secretLifecycleToken);

    case 'TEST_PROVIDER':
      assertTrustedExtensionSender(sender);
      return testProvider();

    case 'TRANSLATE_ACTIVE_TAB':
      assertTrustedExtensionSender(sender);
      return startActiveTabTranslation(message.targetLanguage, message.sourceLanguage);
    case 'SET_LANGUAGE_PREFERENCES':
      assertTrustedExtensionSender(sender);
      return saveLanguagePreferences(message.sourceLanguage, message.targetLanguage);
    case 'SET_SELECTION_QUICK_ACTION':
      assertTrustedExtensionSender(sender);
      return saveSelectionQuickAction(message.enabled);
    case 'CONFIGURE_SELECTION_QUICK_ACTION':
      assertTrustedExtensionSender(sender);
      return configureSelectionQuickAction(message.enabled, message.sourceLanguage, message.targetLanguage, message.translationColor);

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
    case 'REQUEST_SELECTION_TRANSLATION':
      return requestSelectionTranslation(message.text, assertTabSender(sender), sender.frameId || 0);

    case 'TRANSLATE_I18N_BATCH':
      assertTrustedExtensionSender(sender);
      return translateI18nBatch(message);

    default:
      throw new Error('不支持的扩展消息');
  }
}

async function getPublicProviderSettings(): Promise<PublicProviderSettings> {
  const settings = normalizeProviderLanguagePreferences(parseProviderSettings(await providerSettingsStorage.getValue()));
  // TD-2026-028: resolve the key through the per-origin map first so the
  // hasApiKey flag reflects the *current* baseUrl, not the legacy global
  // slot (which keeps only the last saved key).
  const apiKey = await getApiKey(settings.apiKeyPersistence, settings.baseUrl, {
    apiKeyByOrigin: settings.apiKeyByOrigin,
  }).catch((error: unknown) => {
    if (error instanceof VaultLockedError || error instanceof VaultNotInitializedError) return '';
    throw error;
  });
  // The stored settings object carries the raw key (TD-2026-WS3); the
  // public response must never include it. buildPublicProviderSettings
  // strips apiKey / apiKeyByOrigin before the payload crosses the
  // runtime boundary.
  return buildPublicProviderSettings(settings, Boolean(apiKey));
}

async function saveProviderSettings(
  settings: ProviderSettings,
  apiKey?: string,
  lifecycleToken?: SecretLifecycleToken,
): Promise<OperationResult> {
  // Capture before the first await. CLEAR_VAULT advances this generation at
  // its call site, invalidating a save that is still reading old settings.
  const effectiveLifecycleToken = lifecycleToken ?? captureSecretLifecycleToken();
  const validatedSettings = normalizeProviderLanguagePreferences(parseConfiguredProviderSettings(settings));
  const previousSettings = normalizeProviderLanguagePreferences(
    parseProviderSettings(await providerSettingsStorage.getValue()),
  );
  const persistenceChanged = previousSettings.apiKeyPersistence !== validatedSettings.apiKeyPersistence;
  // Key migration is origin-scoped. A single save that changes both the
  // Provider origin and persistence mode cannot know whether an empty key
  // means "keep" or "replace"; moving by the new origin could orphan or
  // delete the old Provider's key. Require two explicit saves instead.
  if (hasCombinedProviderTransition(previousSettings, validatedSettings)) {
    throw new Error('请先单独保存模型服务地址，再单独切换 API Key 保存方式');
  }

  if (apiKey?.trim() || persistenceChanged) {
    // The public settings view omits `apiKeyByOrigin` for runtime
    // contract safety; pull the per-origin map off the same object
    // via a cast so the storage layer can keep the per-provider
    // keys isolated.
    const validatedWithKeyMap = validatedSettings as typeof validatedSettings & {
      apiKeyByOrigin?: Record<string, string>;
    };
    await saveApiKey(
      apiKey?.trim() || '',
      validatedSettings.apiKeyPersistence,
      validatedSettings.baseUrl,
      {
        apiKeyByOrigin: validatedWithKeyMap.apiKeyByOrigin,
        modeChanged: persistenceChanged,
        // Keep the settings item and the secret stores in one compensating
        // transaction. saveApiKey commits this redacted value with its
        // queue-free internal setter while holding the lifecycle lock.
        commitSettings: validatedSettings,
        lifecycleToken: effectiveLifecycleToken,
      },
    );
    return { ok: true, message: '配置已保存' };
  }

  await providerSettingsStorage.setValue(validatedSettings, effectiveLifecycleToken);

  return { ok: true, message: '配置已保存' };
}

async function testProvider(): Promise<OperationResult> {
  const settings = normalizeProviderLanguagePreferences(parseConfiguredProviderSettings(await providerSettingsStorage.getValue()));
  const apiKey = await getApiKey(settings.apiKeyPersistence, settings.baseUrl, {
    apiKeyByOrigin: settings.apiKeyByOrigin,
  });
  await provider.testConnection(settings, apiKey);
  return { ok: true, message: '连接成功，模型已返回测试翻译' };
}

async function translateBatch(
  request: Extract<RuntimeMessage, { type: 'TRANSLATE_BATCH' }>['request'],
  tabId: number,
): Promise<TranslationBatchResponse> {
  abortTabTranslation(tabId);
  const controller = new AbortController();
  registerController(tabId, controller);

  try {
    return await translateWithCache(provider, request, controller.signal);
  } finally {
    unregisterController(tabId, controller);
  }
}

async function estimateTranslationRequest(
  request: Extract<RuntimeMessage, { type: 'ESTIMATE_TRANSLATION' }>['request'],
): Promise<TranslationEstimateResponse> {
  return estimateTranslationWithCache(request);
}

async function startActiveTabTranslation(targetLanguage: string, sourceLanguage = 'auto'): Promise<OperationResult> {
  await storageReadiness.ensure();
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
    targetLanguage: resolveTargetLanguage(targetLanguage),
    sourceLanguage,
    displayMode: settings.displayMode,
    translationColor: settings.translationColor,
    selectionQuickAction: settings.selectionQuickAction === true,
    headerPopupRescan: settings.headerPopupRescan === true,
    forceRefresh: previousState.hasRun,
  } satisfies RuntimeMessage);
  await browser.storage.session
    .set({ [LAST_TRANSLATED_TAB_ID_KEY]: tab.id })
    .catch(() => undefined);

  return { ok: true, message: '已开始翻译当前网页' };
}

async function saveLanguagePreferences(sourceLanguage: string, targetLanguage: string): Promise<OperationResult> {
  const settings = normalizeProviderLanguagePreferences(parseProviderSettings(await providerSettingsStorage.getValue()));
  await providerSettingsStorage.setValue({ ...settings, sourceLanguage, targetLanguage });
  return { ok: true, message: '语言偏好已保存' };
}

async function saveSelectionQuickAction(enabled: boolean): Promise<OperationResult> {
  const settings = normalizeProviderLanguagePreferences(parseProviderSettings(await providerSettingsStorage.getValue()));
  await providerSettingsStorage.setValue({ ...settings, selectionQuickAction: enabled });
  return { ok: true, message: enabled ? '已开启选区快捷翻译' : '已关闭选区快捷翻译' };
}

async function configureSelectionQuickAction(
  enabled: boolean,
  sourceLanguage?: string,
  targetLanguage?: string,
  translationColor?: string,
): Promise<OperationResult> {
  const tab = await getSelectionTargetTab();
  await browser.scripting.executeScript({ target: { tabId: tab.id }, files: ['/translator.js'] });
  await browser.tabs.sendMessage(tab.id, {
    type: 'CONFIGURE_SELECTION_QUICK_ACTION',
    enabled, sourceLanguage, targetLanguage, translationColor,
  } satisfies RuntimeMessage);
  return { ok: true, message: enabled ? '已开启选区快捷翻译' : '已关闭选区快捷翻译' };
}

async function getSelectionTargetTab(): Promise<{ id: number }> {
  await storageReadiness.ensure();
  const stored = await browser.storage.session.get(LAST_WEB_TAB_ID_KEY);
  const storedTabId = stored[LAST_WEB_TAB_ID_KEY];
  if (Number.isInteger(storedTabId) && (storedTabId as number) >= 0) {
    const storedTab = await browser.tabs.get(storedTabId as number).catch(() => undefined);
    if (storedTab?.id && isWebPageUrl(storedTab.url)) return { id: storedTab.id };
  }
  const tabs = await browser.tabs.query({ currentWindow: true });
  const webTabs = tabs
    .filter((tab) => tab.id && isWebPageUrl(tab.url))
    .sort((left, right) => (right.lastAccessed || 0) - (left.lastAccessed || 0));
  const fallback = webTabs[0];
  if (fallback?.id) return { id: fallback.id };
  const active = await getActiveTabDetails();
  return { id: active.id };
}

async function registerSelectionMenu(): Promise<void> {
  if (!browser.contextMenus) return;
  await browser.contextMenus.removeAll().catch(() => undefined);
  await browser.contextMenus.create({
    id: 'textduet-translate-selection',
    title: '翻译选中文本',
    contexts: ['selection'],
  });
}

async function startSelectionTranslation(tabId: number, frameId: number, text: string): Promise<void> {
  await storageReadiness.ensure();
  const settings = normalizeProviderLanguagePreferences(parseProviderSettings(await providerSettingsStorage.getValue()));
  await browser.scripting.executeScript({ target: { tabId, frameIds: [frameId] }, files: ['/translator.js'] });
  await browser.tabs.sendMessage(tabId, {
    type: 'TRANSLATE_SELECTION',
    text,
    sourceLanguage: settings.sourceLanguage || 'auto',
    targetLanguage: resolveTargetLanguage(settings.targetLanguage),
    translationColor: settings.translationColor,
  }, { frameId });
}

async function requestSelectionTranslation(text: string, tabId: number, frameId: number): Promise<OperationResult> {
  const settings = normalizeProviderLanguagePreferences(parseProviderSettings(await providerSettingsStorage.getValue()));
  if (settings.selectionQuickAction !== true) throw new Error('选区快捷翻译已关闭');
  await startSelectionTranslation(tabId, frameId, text);
  return { ok: true, message: '已开始翻译选中文本' };
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
  const cached = writeActiveModelToOriginCache(
    { ...settings, model: normalizedModel, models },
    { model: normalizedModel, models },
  );
  await providerSettingsStorage.setValue(cached);
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
  await storageReadiness.ensure();
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
  if (!isWebPageUrl(tab.url)) {
    throw new Error('浏览器内部页面不支持翻译');
  }
  return { id: tab.id, url: tab.url };
}

function isWebPageUrl(url: string | undefined): url is string {
  return Boolean(url?.startsWith('http://') || url?.startsWith('https://'));
}

async function rememberWebTab(tabId: number): Promise<void> {
  await storageReadiness.ensure();
  const tab = await browser.tabs.get(tabId).catch(() => undefined);
  if (!tab?.id || !isWebPageUrl(tab.url)) return;
  await browser.storage.session.set({ [LAST_WEB_TAB_ID_KEY]: tab.id });
}

async function clearLastWebTab(tabId: number): Promise<void> {
  await storageReadiness.ensure();
  const stored = await browser.storage.session.get(LAST_WEB_TAB_ID_KEY);
  if (stored[LAST_WEB_TAB_ID_KEY] === tabId) {
    await browser.storage.session.remove(LAST_WEB_TAB_ID_KEY);
  }
}

function assertTabSender(sender: Browser.runtime.MessageSender): number {
  if (sender.id !== browser.runtime.id || !sender.tab?.id || !isWebPageUrl(sender.url || sender.tab.url)) {
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
  const controllers = requestControllersByTab.get(tabId);
  controllers?.forEach((controller) => controller.abort());
  requestControllersByTab.delete(tabId);
}

function registerController(tabId: number, controller: AbortController): void {
  const controllers = requestControllersByTab.get(tabId) || new Set<AbortController>();
  controllers.add(controller);
  requestControllersByTab.set(tabId, controllers);
}

function unregisterController(tabId: number, controller: AbortController): void {
  const controllers = requestControllersByTab.get(tabId);
  if (!controllers) return;
  controllers.delete(controller);
  if (controllers.size === 0) requestControllersByTab.delete(tabId);
}

async function clearLastTranslatedTab(tabId: number): Promise<void> {
  await storageReadiness.ensure();
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

  if (typeof localStorage.setAccessLevel !== 'function' || typeof sessionStorage.setAccessLevel !== 'function') {
    throw new Error('浏览器不支持受信存储访问控制');
  }
  await Promise.all([
    localStorage.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' }),
    sessionStorage.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' }),
  ]);
}

/**
 * Restrict browser storage before the first migration/read. Failure is
 * fail-closed: do not migrate or expose secrets when trusted-context access
 * cannot be established.
 */
async function initializeStorageSecurity(): Promise<void> {
  await restrictStorageAccess();
  try {
    const result = await migrateLegacySecrets();
    if (result.discardedPersistentKeyCount > 0) {
      console.warn('[textduet] legacy persistent key data was removed because no unlocked vault was available');
    }
  } catch (error) {
    console.warn('[textduet] legacy secret migration deferred until storage is available');
    throw error;
  }
}

// ---- User-locale dictionary translation (TD-2026-024) ----
//
// Drives a single batch of zh-CN UI keys through the configured
// Provider and returns a {key -> translatedString} map. Called
// repeatedly by Options / Popup with smaller batches to keep input
// tokens bounded; the call site is responsible for merging results
// and persisting via src/i18n/user-locales.

async function translateI18nBatch(
  message: Extract<RuntimeMessage, { type: 'TRANSLATE_I18N_BATCH' }>,
): Promise<I18nBatchTranslationResult> {
  const settings = parseProviderSettings(await providerSettingsStorage.getValue());
  const apiKey = await getApiKey(settings.apiKeyPersistence, settings.baseUrl, {
    apiKeyByOrigin: settings.apiKeyByOrigin,
  });
  if (!apiKey) {
    return { ok: false, errorMessage: '请先在 01 模型服务配置 API Key' };
  }
  if (!settings.model.trim()) {
    return { ok: false, errorMessage: '请先填写模型名称' };
  }
  const batch = message.sourceBatch;
  const keys = Object.keys(batch);
  if (keys.length === 0) {
    return { ok: true, translations: {} };
  }
  const prompt = buildI18nBatchPrompt({
    targetTag: message.targetTag,
    targetLocale: message.targetLocale,
    sourceBatch: batch,
  });
  try {
    const result = await requestFreeformCompletion(
      settings,
      apiKey,
      {
        system: prompt.system,
        user: prompt.user,
        jsonMode: true,
        temperature: 0.1,
      },
    );
    const translations = extractI18nTranslations(result.content, keys);
    return {
      ok: true,
      translations,
      model: result.model,
    };
  } catch (error) {
    if (error instanceof FreeformCompletionError) {
      return { ok: false, errorMessage: error.message };
    }
    return {
      ok: false,
      errorMessage: error instanceof Error ? error.message : '翻译失败',
    };
  }
}
