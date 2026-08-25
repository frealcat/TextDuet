import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyLocale,
  getUserLocale,
  hasUserLocale,
  listUserLocales,
  loadAllUserLocales,
  resetUserLocaleCacheForTest,
  setStorageBackend,
  setUserLocale,
  t,
  translateUiTo,
  clearUserLocale,
  clearAllUserLocales,
  type Fetcher,
  type LocaleTag,
} from '@/src/i18n';
import { buildI18nBatchPrompt } from '@/src/i18n/i18n-prompt';

afterEach(async () => {
  applyLocale('zh-CN', 'auto');
  resetUserLocaleCacheForTest();
  setStorageBackend(null);
  await Promise.resolve();
});

// ---- catalog lookup order ----

describe('i18n user-locale catalog', () => {
  beforeEach(async () => {
    setStorageBackend({
      async getItem() { return undefined; },
      async setItem() { /* noop */ },
      async removeItem() { /* noop */ },
    });
  });

  it('returns zh-CN strings when no user locale is set', () => {
    applyLocale('zh-CN', 'zh-CN');
    expect(t('popup.brand.title')).toBe('TextDuet');
    expect(t('options.section.provider.title')).toBe('模型服务');
  });

  it('returns en strings when explicitly chosen', () => {
    applyLocale('en', 'en');
    // 'options.section.provider.title' en value is "Model provider".
    expect(t('options.section.provider.title')).toBe('Model provider');
  });

  it('falls back to zh-CN for missing keys in the active locale', () => {
    applyLocale('en', 'en');
    expect(t('__missing__key__')).toBe('__missing__key__');
  });

  it('prefers user-translated dict over built-in catalogs', async () => {
    await setUserLocale(
      'fr-FR',
      { 'options.section.provider.title': 'Fournisseur de modèle' },
      'mock-model',
    );
    applyLocale('fr-FR' as LocaleTag, 'fr-FR' as LocaleTag);
    expect(t('options.section.provider.title')).toBe('Fournisseur de modèle');
    // Built-in keys not present in user dict still fall back to zh-CN.
    expect(t('popup.brand.title')).toBe('TextDuet');
  });
});

// ---- user-locales storage layer ----

describe('user-locales storage', () => {
  beforeEach(async () => {
    setStorageBackend({
      async getItem() { return undefined; },
      async setItem() { /* noop */ },
      async removeItem() { /* noop */ },
    });
  });

  it('rejects built-in locales (zh-CN, en)', async () => {
    await expect(
      setUserLocale('zh-CN', { 'options.section.provider.title': 'X' }, 'mock'),
    ).rejects.toThrow(/built-in locale/);
    await expect(
      setUserLocale('en', { 'options.section.provider.title': 'X' }, 'mock'),
    ).rejects.toThrow(/built-in locale/);
  });

  it('persists via injected backend on setUserLocale', async () => {
    const setItem = vi.fn(async () => undefined);
    setStorageBackend({
      async getItem() { return undefined; },
      setItem,
      async removeItem() { /* noop */ },
    });
    await setUserLocale(
      'ja-JP',
      { 'options.section.provider.title': 'モデルサービス' },
      'mock-model',
    );
    // setUserLocale writes both the data record and the tag index.
    const calls = setItem.mock.calls as unknown as Array<[string, unknown]>;
    expect(calls.length).toBeGreaterThanOrEqual(2);
    const dataCall = calls.find(
      ([key]) => key === 'textduet-user-locale-ja-JP-v1.json',
    );
    expect(dataCall).toBeDefined();
    const value = dataCall![1];
    expect(value).toMatchObject({
      tag: 'ja-JP',
      promptVersion: 'v1',
      sourceModel: 'mock-model',
      messages: { 'options.section.provider.title': 'モデルサービス' },
    });
  });

  it('clears a single user locale', async () => {
    setStorageBackend({
      async getItem() { return undefined; },
      async setItem() { /* noop */ },
      async removeItem() { /* noop */ },
    });
    await setUserLocale('fr-FR', { x: 'y' }, 'm');
    expect(hasUserLocale('fr-FR')).toBe(true);
    await clearUserLocale('fr-FR');
    expect(hasUserLocale('fr-FR')).toBe(false);
  });

  it('clears all user locales', async () => {
    setStorageBackend({
      async getItem() { return undefined; },
      async setItem() { /* noop */ },
      async removeItem() { /* noop */ },
    });
    await setUserLocale('fr-FR', { x: 'y' }, 'm');
    await setUserLocale('ja-JP', { x: 'y' }, 'm');
    const cleared = await clearAllUserLocales();
    expect(cleared).toBe(2);
    expect(listUserLocales()).toEqual([]);
  });

  it('loadAllUserLocales picks up textduet-user-locale-* keys from storage', async () => {
    const stored: Record<string, unknown> = {
      '__textduet_user_locale_index__': { tags: ['fr-FR', 'ja-JP'] },
      'textduet-user-locale-fr-FR-v1.json': {
        tag: 'fr-FR',
        promptVersion: 'v1',
        sourceModel: 'cached',
        translatedAt: 1,
        entryCount: 1,
        messages: { 'options.section.provider.title': 'Fournisseur' },
      },
      'unrelated-key': 'skip me',
      'textduet-user-locale-ja-JP-v1.json': {
        tag: 'ja-JP',
        promptVersion: 'v1',
        sourceModel: 'cached',
        translatedAt: 2,
        entryCount: 1,
        messages: { 'options.section.provider.title': 'モデル' },
      },
    };
    setStorageBackend({
      async getItem(key) { return stored[key]; },
      async setItem() { /* noop */ },
      async removeItem() { /* noop */ },
    });
    const loaded = await loadAllUserLocales();
    expect(loaded.map((r) => r.tag)).toEqual(['ja-JP', 'fr-FR']);
    expect(getUserLocale('fr-FR')).toEqual({ 'options.section.provider.title': 'Fournisseur' });
  });
});

// ---- translate-dictionary orchestrator ----

describe('translateUiTo', () => {
  beforeEach(() => {
    setStorageBackend({
      async getItem() { return undefined; },
      async setItem() { /* noop */ },
      async removeItem() { /* noop */ },
    });
  });

  it('rejects built-in locales without making a request', async () => {
    const fetcher = vi.fn(async () => ({ ok: true, translations: {} }));
    const r1 = await translateUiTo('zh-CN' as LocaleTag, { fetcher: fetcher as unknown as Fetcher, displayName: '中文' });
    const r2 = await translateUiTo('en' as LocaleTag, { fetcher: fetcher as unknown as Fetcher, displayName: 'English' });
    expect(r1.ok).toBe(false);
    expect(r2.ok).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('batches by I18N_BATCH_SIZE and merges results', async () => {
    const fetcher = vi.fn(async (_tag: string, _locale: string, sourceBatch: Record<string, string>) => {
      const out: Record<string, string> = {};
      for (const k of Object.keys(sourceBatch)) out[k] = `T(${k})`;
      return { ok: true, translations: out, model: 'm' };
    });
    const result = await translateUiTo('fr-FR' as LocaleTag, {
      fetcher: fetcher as unknown as Fetcher,
      displayName: 'Français',
      batchSize: 5,
      source: {
        k1: 'v1', k2: 'v2', k3: 'v3', k4: 'v4', k5: 'v5',
        k6: 'v6', k7: 'v7', k8: 'v8', k9: 'v9', k10: 'v10',
        k11: 'v11', k12: 'v12',
      },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.sourceModel).toBe('m');
      expect(result.entryCount).toBe(12);
    }
    // 12 / 5 = 3 batches
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('returns ok=false if any batch fails', async () => {
    let calls = 0;
    const fetcher: Fetcher = async () => {
      calls += 1;
      if (calls === 2) return { ok: false, errorMessage: 'rate limited' };
      return { ok: true, translations: {}, model: 'm' };
    };
    const r = await translateUiTo('ja-JP' as LocaleTag, {
      fetcher,
      displayName: '日本語',
      batchSize: 2,
      source: { a: '1', b: '2', c: '3', d: '4' },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errorMessage).toBe('rate limited');
  });

  it('skips the network when user locale is already cached', async () => {
    setStorageBackend({
      async getItem() { return undefined; },
      async setItem() { /* noop */ },
      async removeItem() { /* noop */ },
    });
    await setUserLocale('de-DE', { 'options.section.provider.title': 'Bereits da' }, 'cached');
    const fetcher = vi.fn(async () => ({ ok: true, translations: {} }));
    const r = await translateUiTo('de-DE' as LocaleTag, { fetcher: fetcher as unknown as Fetcher, displayName: 'Deutsch' });
    expect(r.ok).toBe(true);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('reports progress per batch', async () => {
    const calls: string[] = [];
    const fetcher: Fetcher = async (_t, _l, batch) => {
      return { ok: true, translations: Object.fromEntries(Object.keys(batch).map((k) => [k, 'x'])), model: 'm' };
    };
    await translateUiTo('es-ES' as LocaleTag, {
      fetcher,
      displayName: 'Español',
      batchSize: 2,
      source: { a: '1', b: '2', c: '3', d: '4' },
      onProgress: (p) => { calls.push(`${p.done}/${p.total}`); },
    });
    expect(calls.length).toBeGreaterThanOrEqual(2);
  });
});

// ---- prompt builder ----

describe('buildI18nBatchPrompt', () => {
  it('substitutes target locale and tab in the system prompt', () => {
    const prompt = buildI18nBatchPrompt({
      targetTag: 'fr-FR',
      targetLocale: 'Français',
      sourceBatch: { 'k1': 'v1' },
    });
    expect(prompt.system).toContain('Français');
    expect(prompt.system).toContain('fr-FR');
    expect(prompt.system).not.toContain('{TARGET_LOCALE}');
    expect(prompt.user).toContain('target_locale: Français');
    expect(prompt.user).toContain('k1\tv1');
  });

  it('preserves proper-noun list and placeholder rules in the system prompt', () => {
    const prompt = buildI18nBatchPrompt({
      targetTag: 'ja-JP',
      targetLocale: '日本語',
      sourceBatch: {},
    });
    expect(prompt.system).toMatch(/TextDuet/);
    expect(prompt.system).toMatch(/API Key/);
    expect(prompt.system).toMatch(/BYOK/);
    expect(prompt.system).toMatch(/Provider/);
    expect(prompt.system).toMatch(/\{input\}/);
  });
});
