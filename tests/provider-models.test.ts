import { describe, expect, it } from 'vitest';
import {
  getModelForOrigin,
  getModelsForOrigin,
  hasCombinedProviderTransition,
  isSavedApiKeyForOrigin,
  migrateProviderModelsToOriginCache,
  normalizeBaseUrlOrigin,
  switchBaseUrlWithModelCache,
  writeActiveModelToOriginCache,
} from '@/src/storage/provider-models';

describe('provider-models helpers', () => {
  describe('isSavedApiKeyForOrigin', () => {
    it('accepts a saved status for the same origin, including a path change', () => {
      expect(isSavedApiKeyForOrigin(
        true,
        'https://api.example.com',
        'https://api.example.com/v2',
      )).toBe(true);
    });

    it('rejects a status from a different origin', () => {
      expect(isSavedApiKeyForOrigin(
        true,
        'https://api.openai.com',
        'https://api.deepseek.com',
      )).toBe(false);
    });

    it('rejects an absent status or invalid current URL', () => {
      expect(isSavedApiKeyForOrigin(false, 'https://api.example.com', 'https://api.example.com/v1'))
        .toBe(false);
      expect(isSavedApiKeyForOrigin(true, 'https://api.example.com', 'not-a-url'))
        .toBe(false);
    });
  });

  describe('hasCombinedProviderTransition', () => {
    it('rejects changing origin and key persistence in one save', () => {
      expect(hasCombinedProviderTransition(
        { baseUrl: 'https://api.openai.com/v1', apiKeyPersistence: 'session' },
        { baseUrl: 'https://api.deepseek.com', apiKeyPersistence: 'local' },
      )).toBe(true);
    });

    it('allows a path-only origin edit or a mode-only edit', () => {
      expect(hasCombinedProviderTransition(
        { baseUrl: 'https://api.example.com/v1', apiKeyPersistence: 'session' },
        { baseUrl: 'https://api.example.com/v2', apiKeyPersistence: 'local' },
      )).toBe(false);
      expect(hasCombinedProviderTransition(
        { baseUrl: 'https://api.example.com/v1', apiKeyPersistence: 'session' },
        { baseUrl: 'https://api.example.com/v1', apiKeyPersistence: 'local' },
      )).toBe(false);
    });
  });

  describe('normalizeBaseUrlOrigin', () => {
    it('returns the https origin for a valid url', () => {
      expect(normalizeBaseUrlOrigin('https://api.openai.com/v1')).toBe('https://api.openai.com');
      expect(normalizeBaseUrlOrigin('https://dashscope.aliyuncs.com/compatible-mode/v1'))
        .toBe('https://dashscope.aliyuncs.com');
    });

    it('rejects non-https schemes and malformed urls', () => {
      expect(normalizeBaseUrlOrigin('http://api.example.com/v1')).toBeNull();
      expect(normalizeBaseUrlOrigin('not-a-url')).toBeNull();
      expect(normalizeBaseUrlOrigin('https://user:pass@api.example.com/v1')).toBeNull();
      expect(normalizeBaseUrlOrigin('https://api.example.com/v1?key=secret')).toBeNull();
      expect(normalizeBaseUrlOrigin('https://api.example.com/v1#fragment')).toBeNull();
    });
  });

  describe('migrateProviderModelsToOriginCache', () => {
    it('copies active model and list into the maps on first run', () => {
      const result = migrateProviderModelsToOriginCache({
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4o-mini',
        models: ['gpt-4o-mini', 'gpt-4.1-mini'],
        modelByOrigin: {},
        modelsByOrigin: {},
      });
      expect(result.modelByOrigin).toEqual({ 'https://api.openai.com': 'gpt-4o-mini' });
      expect(result.modelsByOrigin).toEqual({
        'https://api.openai.com': ['gpt-4o-mini', 'gpt-4.1-mini'],
      });
    });

    it('preserves existing per-origin entries', () => {
      const result = migrateProviderModelsToOriginCache({
        baseUrl: 'https://api.openai.com/v1',
        model: 'openai-current',
        models: ['openai-current'],
        modelByOrigin: { 'https://api.deepseek.com': 'deepseek-chat' },
        modelsByOrigin: { 'https://api.deepseek.com': ['deepseek-chat'] },
      });
      expect(result.modelByOrigin).toEqual({
        'https://api.deepseek.com': 'deepseek-chat',
        'https://api.openai.com': 'openai-current',
      });
    });

    it('is a no-op when no model or list is set', () => {
      const result = migrateProviderModelsToOriginCache({
        baseUrl: 'https://api.openai.com/v1',
        model: '',
        models: [] as string[],
        modelByOrigin: {},
        modelsByOrigin: {},
      });
      expect(result.modelByOrigin).toEqual({});
      expect(result.modelsByOrigin).toEqual({});
    });
  });

  describe('switchBaseUrlWithModelCache', () => {
    it('saves the current state and loads the new origin cache when switching providers', () => {
      // previous state: user is on openai with openai's data
      const result = switchBaseUrlWithModelCache(
        {
          baseUrl: 'https://api.openai.com/v1',
          model: 'gpt-4o-mini',
          models: ['gpt-4o-mini', 'gpt-4.1-mini'],
          modelByOrigin: {},
          modelsByOrigin: {},
        },
        'https://api.deepseek.com',
      );
      // openai's data is saved to the maps
      expect(result.modelByOrigin).toEqual({ 'https://api.openai.com': 'gpt-4o-mini' });
      expect(result.modelsByOrigin).toEqual({
        'https://api.openai.com': ['gpt-4o-mini', 'gpt-4.1-mini'],
      });
      // new origin has no cache → active fields reset to empty
      expect(result.baseUrl).toBe('https://api.deepseek.com');
      expect(result.model).toBe('');
      expect(result.models).toEqual([]);
    });

    it('loads cached values when switching back to a previously configured origin', () => {
      // user comes back to openai after configuring deepseek
      const result = switchBaseUrlWithModelCache(
        {
          baseUrl: 'https://api.deepseek.com',
          model: 'deepseek-coder',
          models: ['deepseek-chat', 'deepseek-coder'],
          modelByOrigin: { 'https://api.openai.com': 'gpt-4o-mini' },
          modelsByOrigin: {
            'https://api.openai.com': ['gpt-4o-mini', 'gpt-4.1-mini'],
          },
        },
        'https://api.openai.com/v1',
      );
      // deepseek's current state is saved
      expect(result.modelByOrigin).toEqual({
        'https://api.openai.com': 'gpt-4o-mini',
        'https://api.deepseek.com': 'deepseek-coder',
      });
      expect(result.modelsByOrigin).toEqual({
        'https://api.openai.com': ['gpt-4o-mini', 'gpt-4.1-mini'],
        'https://api.deepseek.com': ['deepseek-chat', 'deepseek-coder'],
      });
      // openai's cached values are loaded
      expect(result.model).toBe('gpt-4o-mini');
      expect(result.models).toEqual(['gpt-4o-mini', 'gpt-4.1-mini']);
    });

    it('keeps separate model lists across three providers across multiple switches', () => {
      let state = {
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4o-mini',
        models: ['gpt-4o-mini', 'gpt-4.1-mini'],
        modelByOrigin: {} as Record<string, string>,
        modelsByOrigin: {} as Record<string, string[]>,
      };
      // Switch to deepseek → empty
      state = switchBaseUrlWithModelCache(state, 'https://api.deepseek.com');
      expect(state.model).toBe('');
      expect(state.models).toEqual([]);
      // Configure deepseek
      state = {
        ...state,
        model: 'deepseek-coder',
        models: ['deepseek-chat', 'deepseek-coder'],
      };
      // Switch to siliconflow → empty
      state = switchBaseUrlWithModelCache(state, 'https://api.siliconflow.cn/v1');
      expect(state.model).toBe('');
      expect(state.models).toEqual([]);
      // Configure siliconflow
      state = {
        ...state,
        model: 'Qwen/Qwen3-8B',
        models: ['Qwen/Qwen3-8B'],
      };
      // Back to openai → cached openai list
      state = switchBaseUrlWithModelCache(state, 'https://api.openai.com/v1');
      expect(state.model).toBe('gpt-4o-mini');
      expect(state.models).toEqual(['gpt-4o-mini', 'gpt-4.1-mini']);
      // Back to deepseek → cached deepseek list
      state = switchBaseUrlWithModelCache(state, 'https://api.deepseek.com');
      expect(state.model).toBe('deepseek-coder');
      expect(state.models).toEqual(['deepseek-chat', 'deepseek-coder']);
      // Back to siliconflow → cached siliconflow list
      state = switchBaseUrlWithModelCache(state, 'https://api.siliconflow.cn/v1');
      expect(state.model).toBe('Qwen/Qwen3-8B');
      expect(state.models).toEqual(['Qwen/Qwen3-8B']);
    });
  });

  describe('writeActiveModelToOriginCache', () => {
    it('persists the active model and list to the current origin', () => {
      const result = writeActiveModelToOriginCache(
        {
          baseUrl: 'https://api.openai.com/v1',
          model: 'gpt-4.1-mini',
          models: ['gpt-4.1-mini', 'gpt-4o-mini'],
          modelByOrigin: {},
          modelsByOrigin: {},
        },
        { model: 'gpt-4.1-mini', models: ['gpt-4.1-mini', 'gpt-4o-mini'] },
      );
      expect(result.modelByOrigin).toEqual({ 'https://api.openai.com': 'gpt-4.1-mini' });
      expect(result.modelsByOrigin).toEqual({
        'https://api.openai.com': ['gpt-4.1-mini', 'gpt-4o-mini'],
      });
    });

    it('writes the new model and list back to the active fields, not just the maps', () => {
      const result = writeActiveModelToOriginCache(
        {
          baseUrl: 'https://api.openai.com/v1',
          model: 'gpt-4o-mini',
          models: ['gpt-4o-mini'],
          modelByOrigin: {},
          modelsByOrigin: {},
        },
        { model: 'gpt-4.1-mini', models: ['gpt-4.1-mini', 'gpt-4o-mini'] },
      );
      expect(result.model).toBe('gpt-4.1-mini');
      expect(result.models).toEqual(['gpt-4.1-mini', 'gpt-4o-mini']);
      expect(result.modelByOrigin).toEqual({ 'https://api.openai.com': 'gpt-4.1-mini' });
      expect(result.modelsByOrigin).toEqual({
        'https://api.openai.com': ['gpt-4.1-mini', 'gpt-4o-mini'],
      });
    });

    it('still writes the active field even when the baseUrl cannot be normalized', () => {
      const input = {
        baseUrl: 'not-a-url',
        model: 'old',
        models: ['old'] as string[],
        modelByOrigin: undefined as Record<string, string> | undefined,
        modelsByOrigin: undefined as Record<string, string[]> | undefined,
      };
      const result = writeActiveModelToOriginCache(input, { model: 'new', models: ['new'] });
      expect(result.model).toBe('new');
      expect(result.models).toEqual(['new']);
      expect(result.modelByOrigin).toEqual({});
      expect(result.modelsByOrigin).toEqual({});
    });
  });

  describe('getModelForOrigin / getModelsForOrigin', () => {
    it('returns the cached value for the current origin', () => {
      expect(
        getModelForOrigin('https://api.openai.com/v1', {
          'https://api.openai.com': 'gpt-4o-mini',
        }),
      ).toBe('gpt-4o-mini');
    });

    it('returns an empty string when the origin is not cached', () => {
      expect(getModelForOrigin('https://api.openai.com/v1', {})).toBe('');
    });

    it('returns the cached list for the current origin', () => {
      expect(
        getModelsForOrigin(
          'https://api.openai.com/v1',
          ['fallback-1', 'fallback-2'],
          { 'https://api.openai.com': ['gpt-4o-mini', 'gpt-4.1-mini'] },
        ),
      ).toEqual(['gpt-4o-mini', 'gpt-4.1-mini']);
    });

    it('falls back to the active list when the origin is not cached', () => {
      expect(
        getModelsForOrigin('https://api.openai.com/v1', ['fallback'], undefined),
      ).toEqual(['fallback']);
    });
  });
});
