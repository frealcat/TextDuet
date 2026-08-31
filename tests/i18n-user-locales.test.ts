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

  it('rejects unsafe locale tags, oversized model metadata, and invalid timestamps', async () => {
    const setItem = vi.fn(async () => undefined);
    setStorageBackend({
      async getItem() { return undefined; },
      setItem,
      async removeItem() { /* noop */ },
    });
    await expect(setUserLocale('fr/FR', { title: 'Titre' }, 'mock'))
      .rejects.toThrow('语言标签无效');
    await expect(setUserLocale('fr-FR', { title: 'Titre' }, 'm'.repeat(257)))
      .rejects.toThrow('模型名称过长');
    await expect(setUserLocale('fr-FR', { title: 'Titre' }, 'mock', -1))
      .rejects.toThrow('时间戳无效');
    await expect(setUserLocale('fr-FR', { title: 'Titre' }, 'mock', 8_640_000_000_000_001))
      .rejects.toThrow('时间戳无效');
    await expect(setUserLocale('fr-FR', { title: 'Titre' }, 'model\nname'))
      .rejects.toThrow('控制字符');
    expect(setItem).not.toHaveBeenCalled();
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

  it('does not publish an in-memory locale when record persistence fails', async () => {
    const recordKey = 'textduet-user-locale-fr-FR-v1.json';
    const setItem = vi.fn(async (key: string) => {
      if (key === recordKey) throw new Error('record write failed');
    });
    const removeItem = vi.fn(async () => undefined);
    setStorageBackend({
      async getItem() { return undefined; },
      setItem,
      removeItem,
    });

    await expect(setUserLocale('fr-FR', { title: 'Titre' }, 'mock'))
      .rejects.toThrow('record write failed');
    expect(hasUserLocale('fr-FR')).toBe(false);
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(removeItem).toHaveBeenCalledWith(recordKey);
  });

  it('rolls back a partial update when index persistence fails', async () => {
    const recordKey = 'textduet-user-locale-fr-FR-v1.json';
    const indexKey = '__textduet_user_locale_index__';
    const oldRecord = {
      tag: 'fr-FR',
      promptVersion: 'v1',
      sourceModel: 'old-model',
      translatedAt: 1,
      entryCount: 1,
      messages: { title: 'Ancien' },
    };
    const oldIndex = { tags: ['fr-FR'] };
    const stored: Record<string, unknown> = {
      [recordKey]: oldRecord,
      [indexKey]: oldIndex,
    };
    let failIndexWrite = true;
    setStorageBackend({
      async getItem(key) { return stored[key]; },
      async setItem(key, value) {
        if (key === indexKey && failIndexWrite) {
          failIndexWrite = false;
          // Simulate a backend that applied the write before reporting an
          // error, so the rollback path must restore the previous index.
          stored[key] = value;
          throw new Error('index write failed');
        }
        stored[key] = value;
      },
      async removeItem(key) { delete stored[key]; },
    });

    await loadAllUserLocales();
    expect(getUserLocale('fr-FR')).toEqual({ title: 'Ancien' });
    await expect(setUserLocale('fr-FR', { title: 'Nouveau' }, 'new-model', 2))
      .rejects.toThrow('index write failed');
    expect(getUserLocale('fr-FR')).toEqual({ title: 'Ancien' });
    expect(stored[recordKey]).toEqual(oldRecord);
    expect(stored[indexKey]).toEqual(oldIndex);
  });

  it('serializes concurrent locale writes so the index keeps both tags', async () => {
    const stored: Record<string, unknown> = {};
    setStorageBackend({
      async getItem(key) { return stored[key]; },
      async setItem(key, value) {
        // Yield to make an unsynchronized read-modify-write observable.
        await Promise.resolve();
        stored[key] = value;
      },
      async removeItem(key) { delete stored[key]; },
    });

    await Promise.all([
      setUserLocale('fr-FR', { title: 'Titre' }, 'model-a', 1),
      setUserLocale('ja-JP', { title: 'モデル' }, 'model-b', 2),
    ]);
    expect(stored.__textduet_user_locale_index__).toEqual({ tags: ['fr-FR', 'ja-JP'] });
    expect(hasUserLocale('fr-FR')).toBe(true);
    expect(hasUserLocale('ja-JP')).toBe(true);
  });

  it('does not let a concurrent load resurrect a locale cleared later', async () => {
    const recordKey = 'textduet-user-locale-fr-FR-v1.json';
    const indexKey = '__textduet_user_locale_index__';
    const record = {
      tag: 'fr-FR',
      promptVersion: 'v1',
      sourceModel: 'cached',
      translatedAt: 1,
      entryCount: 1,
      messages: { title: 'Titre' },
    };
    const stored: Record<string, unknown> = {
      [indexKey]: { tags: ['fr-FR'] },
      [recordKey]: record,
    };
    let pauseClearRead = false;
    let pauseLoadRead = false;
    let clearReadStarted!: () => void;
    let loadReadStarted!: () => void;
    let releaseClearRead!: () => void;
    let releaseLoadRead!: () => void;
    const clearRead = new Promise<void>((resolve) => { clearReadStarted = resolve; });
    const loadRead = new Promise<void>((resolve) => { loadReadStarted = resolve; });
    const blockedClearRead = new Promise<void>((resolve) => { releaseClearRead = resolve; });
    const blockedLoadRead = new Promise<void>((resolve) => { releaseLoadRead = resolve; });
    setStorageBackend({
      async getItem(key) {
        if (key === recordKey && pauseClearRead) {
          pauseClearRead = false;
          clearReadStarted();
          await blockedClearRead;
        } else if (key === recordKey && pauseLoadRead) {
          pauseLoadRead = false;
          loadReadStarted();
          await blockedLoadRead;
        }
        return stored[key];
      },
      async setItem(key, value) { stored[key] = value; },
      async removeItem(key) { delete stored[key]; },
    });

    await loadAllUserLocales();
    pauseClearRead = true;
    pauseLoadRead = true;
    const clearing = clearUserLocale('fr-FR');
    await clearRead;
    const loading = loadAllUserLocales();
    // An unqueued load can read the old record while clear is paused. Hold
    // that read until clear has finished so the stale snapshot is committed
    // after the deletion, which would resurrect the locale.
    await Promise.race([
      loadRead,
      Promise.resolve(),
    ]);
    releaseClearRead();
    await clearing;
    releaseLoadRead();
    await Promise.all([loading, clearing]);

    expect(hasUserLocale('fr-FR')).toBe(false);
    expect(stored[indexKey]).toEqual({ tags: [] });
    expect(stored[recordKey]).toBeUndefined();
  });

  it('rejects oversized dictionaries before changing memory or storage', async () => {
    const setItem = vi.fn(async () => undefined);
    setStorageBackend({
      async getItem() { return undefined; },
      setItem,
      async removeItem() { /* noop */ },
    });
    await expect(setUserLocale('fr-FR', { huge: 'x'.repeat(16_001) }, 'mock'))
      .rejects.toThrow('长度无效');
    expect(hasUserLocale('fr-FR')).toBe(false);
    expect(setItem).not.toHaveBeenCalled();
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

  it('does not clear built-in locales or touch storage', async () => {
    const removeItem = vi.fn(async () => undefined);
    const getItem = vi.fn(async () => ({ tags: ['en', 'zh-CN'] }));
    const setItem = vi.fn(async () => undefined);
    setStorageBackend({ getItem, setItem, removeItem });

    await expect(clearUserLocale('en')).resolves.toBe(false);
    await expect(clearUserLocale('zh-CN')).resolves.toBe(false);
    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
  });

  it('keeps the in-memory locale when clearing fails', async () => {
    const recordKey = 'textduet-user-locale-fr-FR-v1.json';
    const stored: Record<string, unknown> = {
      [recordKey]: {
        tag: 'fr-FR',
        promptVersion: 'v1',
        sourceModel: 'model',
        translatedAt: 1,
        entryCount: 1,
        messages: { title: 'Titre' },
      },
      __textduet_user_locale_index__: { tags: ['fr-FR'] },
    };
    setStorageBackend({
      async getItem(key) { return stored[key]; },
      async setItem(key, value) { stored[key] = value; },
      async removeItem(key) {
        if (key === recordKey) throw new Error('record remove failed');
      },
    });

    await loadAllUserLocales();
    await expect(clearUserLocale('fr-FR')).rejects.toThrow('record remove failed');
    expect(hasUserLocale('fr-FR')).toBe(true);
    expect(stored[recordKey]).toBeDefined();
    expect(stored.__textduet_user_locale_index__).toEqual({ tags: ['fr-FR'] });
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

  it('clears indexed locales even when the in-memory catalog is cold', async () => {
    const removed: string[] = [];
    const stored: Record<string, unknown> = {
      '__textduet_user_locale_index__': { tags: ['fr-FR', 'ja-JP', 'fr-FR'] },
      'textduet-user-locale-fr-FR-v1.json': { stale: true },
      'textduet-user-locale-ja-JP-v1.json': { stale: true },
    };
    setStorageBackend({
      async getItem(key) { return stored[key]; },
      async setItem() { /* noop */ },
      async removeItem(key) {
        removed.push(key);
        delete stored[key];
      },
    });

    const cleared = await clearAllUserLocales();
    expect(cleared).toBe(2);
    expect(removed.sort()).toEqual([
      '__textduet_user_locale_index__',
      'textduet-user-locale-fr-FR-v1.json',
      'textduet-user-locale-ja-JP-v1.json',
    ]);
    expect(listUserLocales()).toEqual([]);
  });

  it('serializes a catalog refresh with concurrent locale writes', async () => {
    const indexKey = '__textduet_user_locale_index__';
    const stored: Record<string, unknown> = {
      [indexKey]: { tags: ['fr-FR'] },
      'textduet-user-locale-fr-FR-v1.json': {
        tag: 'fr-FR',
        promptVersion: 'v1',
        sourceModel: 'cached',
        translatedAt: 1,
        entryCount: 1,
        messages: { title: 'Titre' },
      },
    };
    let releaseIndexRead!: () => void;
    let indexReadEntered!: () => void;
    const indexGate = new Promise<void>((resolve) => { releaseIndexRead = resolve; });
    const indexEntered = new Promise<void>((resolve) => { indexReadEntered = resolve; });
    let firstIndexRead = true;
    setStorageBackend({
      async getItem(key) {
        if (key === indexKey && firstIndexRead) {
          firstIndexRead = false;
          indexReadEntered();
          await indexGate;
        }
        return stored[key];
      },
      async setItem(key, value) { stored[key] = value; },
      async removeItem(key) { delete stored[key]; },
    });

    const loadPromise = loadAllUserLocales();
    await indexEntered;
    const setPromise = setUserLocale('ja-JP', { title: 'モデル' }, 'new-model', 2);
    await Promise.resolve();
    expect(stored['textduet-user-locale-ja-JP-v1.json']).toBeUndefined();

    releaseIndexRead();
    await Promise.all([loadPromise, setPromise]);
    expect(hasUserLocale('fr-FR')).toBe(true);
    expect(hasUserLocale('ja-JP')).toBe(true);
    expect(stored[indexKey]).toEqual({ tags: ['fr-FR', 'ja-JP'] });
  });

  it('waits for all clear-all removals and restores a partial failure before the next write', async () => {
    const indexKey = '__textduet_user_locale_index__';
    const frKey = 'textduet-user-locale-fr-FR-v1.json';
    const jaKey = 'textduet-user-locale-ja-JP-v1.json';
    const deKey = 'textduet-user-locale-de-DE-v1.json';
    const stored: Record<string, unknown> = {
      [indexKey]: { tags: ['fr-FR', 'ja-JP'] },
      [frKey]: {
        tag: 'fr-FR', promptVersion: 'v1', sourceModel: 'cached',
        translatedAt: 1, entryCount: 1, messages: { title: 'Titre' },
      },
      [jaKey]: {
        tag: 'ja-JP', promptVersion: 'v1', sourceModel: 'cached',
        translatedAt: 2, entryCount: 1, messages: { title: 'モデル' },
      },
    };
    let releaseRemoval!: () => void;
    let removalStarted!: () => void;
    const removalGate = new Promise<void>((resolve) => { releaseRemoval = resolve; });
    const removalEntered = new Promise<void>((resolve) => { removalStarted = resolve; });
    let failOnce = true;
    setStorageBackend({
      async getItem(key) { return stored[key]; },
      async setItem(key, value) { stored[key] = value; },
      async removeItem(key) {
        if (key === frKey && failOnce) {
          failOnce = false;
          removalStarted();
          await removalGate;
          delete stored[key];
          throw new Error('record remove failed');
        }
        delete stored[key];
      },
    });

    const clearPromise = clearAllUserLocales();
    await removalEntered;
    const setPromise = setUserLocale('de-DE', { title: 'Titel' }, 'new-model', 3);
    await Promise.resolve();
    expect(stored[deKey]).toBeUndefined();

    releaseRemoval();
    await expect(clearPromise).rejects.toThrow('record remove failed');
    await setPromise;
    expect(stored[frKey]).toBeDefined();
    expect(stored[jaKey]).toBeDefined();
    expect(stored[deKey]).toBeDefined();
    expect(stored[indexKey]).toEqual({ tags: ['fr-FR', 'ja-JP', 'de-DE'] });
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

  it('skips malformed persisted dictionaries instead of loading them', async () => {
    setStorageBackend({
      async getItem(key) {
        if (key === '__textduet_user_locale_index__') return { tags: ['fr-FR'] };
        return {
          tag: 'fr-FR',
          promptVersion: 'v1',
          sourceModel: 'cached',
          translatedAt: 1,
          entryCount: 1,
          messages: { huge: 'x'.repeat(16_001) },
        };
      },
      async setItem() { /* noop */ },
      async removeItem() { /* noop */ },
    });
    await expect(loadAllUserLocales()).resolves.toEqual([]);
    expect(hasUserLocale('fr-FR')).toBe(false);
  });

  it('skips persisted records whose metadata does not match the index', async () => {
    setStorageBackend({
      async getItem(key) {
        if (key === '__textduet_user_locale_index__') return { tags: ['fr-FR'] };
        return {
          tag: 'ja-JP',
          promptVersion: 'v1',
          sourceModel: 'cached',
          translatedAt: 1,
          entryCount: 1,
          messages: { title: 'Titre' },
        };
      },
      async setItem() { /* noop */ },
      async removeItem() { /* noop */ },
    });
    await expect(loadAllUserLocales()).resolves.toEqual([]);
  });

  it('does not load built-in locale records from a tampered index', async () => {
    const stored: Record<string, unknown> = {
      '__textduet_user_locale_index__': { tags: ['en', 'zh-CN', 'fr-FR'] },
      'textduet-user-locale-en-v1.json': {
        tag: 'en',
        promptVersion: 'v1',
        sourceModel: 'tampered',
        translatedAt: 1,
        entryCount: 1,
        messages: { 'options.section.provider.title': 'Fake English' },
      },
      'textduet-user-locale-zh-CN-v1.json': {
        tag: 'zh-CN',
        promptVersion: 'v1',
        sourceModel: 'tampered',
        translatedAt: 2,
        entryCount: 1,
        messages: { 'options.section.provider.title': 'Fake Chinese' },
      },
      'textduet-user-locale-fr-FR-v1.json': {
        tag: 'fr-FR',
        promptVersion: 'v1',
        sourceModel: 'cached',
        translatedAt: 3,
        entryCount: 1,
        messages: { 'options.section.provider.title': 'Fournisseur' },
      },
    };
    setStorageBackend({
      async getItem(key) { return stored[key]; },
      async setItem() { /* noop */ },
      async removeItem() { /* noop */ },
    });

    const loaded = await loadAllUserLocales();
    expect(loaded.map((record) => record.tag)).toEqual(['fr-FR']);
    expect(getUserLocale('en')).toBeUndefined();
    expect(getUserLocale('zh-CN')).toBeUndefined();
    applyLocale('en', 'en');
    expect(t('options.section.provider.title')).toBe('Model provider');
  });

  it('reconstructs persisted records without unknown metadata fields', async () => {
    const stored: Record<string, unknown> = {
      '__textduet_user_locale_index__': { tags: ['fr-FR'] },
      'textduet-user-locale-fr-FR-v1.json': {
        tag: 'fr-FR',
        promptVersion: 'v1',
        sourceModel: 'cached',
        translatedAt: 1,
        entryCount: 1,
        messages: { title: 'Titre' },
        apiKey: 'must-not-enter-memory',
        privateMetadata: { oversized: 'untrusted' },
      },
    };
    setStorageBackend({
      async getItem(key) { return stored[key]; },
      async setItem() { /* noop */ },
      async removeItem() { /* noop */ },
    });

    const loaded = await loadAllUserLocales();
    expect(loaded).toHaveLength(1);
    const record = loaded[0]!;
    expect(Object.keys(record).sort()).toEqual([
      'entryCount',
      'messages',
      'promptVersion',
      'sourceModel',
      'tag',
      'translatedAt',
    ]);
    expect(record).not.toHaveProperty('apiKey');
    expect(listUserLocales()[0]).not.toHaveProperty('privateMetadata');
  });

  it('bounds and deduplicates untrusted index tags before loading', async () => {
    const indexTags = [
      'fr-FR',
      'fr-FR',
      ...Array.from({ length: 200 }, (_, index) => `x-${index}`),
    ];
    const dataReads: string[] = [];
    setStorageBackend({
      async getItem(key) {
        if (key === '__textduet_user_locale_index__') return { tags: indexTags };
        dataReads.push(key);
        return undefined;
      },
      async setItem() { /* noop */ },
      async removeItem() { /* noop */ },
    });

    await loadAllUserLocales();
    expect(dataReads.length).toBeLessThanOrEqual(128);
    expect(new Set(dataReads).size).toBe(dataReads.length);
    expect(dataReads.filter((key) => key === 'textduet-user-locale-fr-FR-v1.json')).toHaveLength(1);
  });

  it('refreshes the in-memory catalog when persisted index entries disappear', async () => {
    let index: unknown = { tags: ['fr-FR'] };
    const record = {
      tag: 'fr-FR',
      promptVersion: 'v1',
      sourceModel: 'cached',
      translatedAt: 1,
      entryCount: 1,
      messages: { title: 'Titre' },
    };
    setStorageBackend({
      async getItem(key) {
        if (key === '__textduet_user_locale_index__') return index;
        return record;
      },
      async setItem() { /* noop */ },
      async removeItem() { /* noop */ },
    });

    await loadAllUserLocales();
    expect(hasUserLocale('fr-FR')).toBe(true);
    index = { tags: [] };
    await expect(loadAllUserLocales()).resolves.toEqual([]);
    expect(hasUserLocale('fr-FR')).toBe(false);
    expect(listUserLocales()).toEqual([]);
  });

  it('normalizes blank persisted model metadata and rejects control characters', async () => {
    let sourceModel = '   ';
    const stored: Record<string, unknown> = {
      '__textduet_user_locale_index__': { tags: ['fr-FR'] },
      'textduet-user-locale-fr-FR-v1.json': {
        tag: 'fr-FR',
        promptVersion: 'v1',
        sourceModel,
        translatedAt: 1,
        entryCount: 1,
        messages: { title: 'Titre' },
      },
    };
    setStorageBackend({
      async getItem(key) { return stored[key]; },
      async setItem() { /* noop */ },
      async removeItem() { /* noop */ },
    });

    const loaded = await loadAllUserLocales();
    expect(loaded[0]?.sourceModel).toBe('unknown');
    sourceModel = 'bad\nmodel';
    stored['textduet-user-locale-fr-FR-v1.json'] = {
      ...(stored['textduet-user-locale-fr-FR-v1.json'] as Record<string, unknown>),
      sourceModel,
    };
    await expect(loadAllUserLocales()).resolves.toEqual([]);
  });

  it('rejects persisted timestamps outside the JavaScript Date range', async () => {
    const stored: Record<string, unknown> = {
      '__textduet_user_locale_index__': { tags: ['fr-FR'] },
      'textduet-user-locale-fr-FR-v1.json': {
        tag: 'fr-FR',
        promptVersion: 'v1',
        sourceModel: 'cached',
        translatedAt: 8_640_000_000_000_001,
        entryCount: 1,
        messages: { title: 'Titre' },
      },
    };
    setStorageBackend({
      async getItem(key) { return stored[key]; },
      async setItem() { /* noop */ },
      async removeItem() { /* noop */ },
    });

    await expect(loadAllUserLocales()).resolves.toEqual([]);
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

  it('rejects non-positive or oversized batch sizes without entering a loop', async () => {
    const fetcher = vi.fn(async () => ({ ok: true, translations: {} }));
    for (const batchSize of [0, -1, Number.NaN, 51]) {
      const result = await translateUiTo('it-IT' as LocaleTag, {
        fetcher: fetcher as unknown as Fetcher,
        displayName: 'Italiano',
        batchSize,
        source: { a: 'A' },
      });
      expect(result).toEqual({ ok: false, errorMessage: '批次大小无效' });
    }
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('filters extra and oversized Provider response entries before persistence', async () => {
    const fetcher: Fetcher = async () => ({
      ok: true,
      translations: {
        a: '已翻译',
        extra: '不得写入',
        huge: 'x'.repeat(16_001),
      },
      model: 'm',
    });
    const result = await translateUiTo('ko-KR' as LocaleTag, {
      fetcher,
      displayName: '한국어',
      source: { a: '原文' },
      batchSize: 1,
    });
    expect(result.ok).toBe(true);
    expect(getUserLocale('ko-KR')).toEqual({ a: '已翻译' });
  });

  it('preserves own dictionary keys that shadow Object.prototype', async () => {
    const fetcher: Fetcher = async () => ({
      ok: true,
      translations: { toString: 'Traduit' },
      model: 'm',
    });
    const result = await translateUiTo('nl-NL' as LocaleTag, {
      fetcher,
      displayName: 'Nederlands',
      source: { toString: 'Source' },
      batchSize: 1,
    });
    expect(result).toMatchObject({ ok: true, entryCount: 1 });
    const messages = getUserLocale('nl-NL');
    expect(messages && Object.hasOwn(messages, 'toString')).toBe(true);
    expect(messages?.toString).toBe('Traduit');
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
