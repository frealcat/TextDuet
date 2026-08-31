/*
 * SPDX-FileCopyrightText: Copyright 2026 frealcat
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import {
  buildPublicProviderSettings,
  parseProviderSettings,
  parsePublicProviderSettings,
} from '@/src/core/schemas';
import { DEFAULT_PROVIDER_SETTINGS } from '@/src/core/defaults';
import type { ProviderSettings } from '@/src/core/contracts';

/**
 * TD-2026-028 regression: after TD-2026-WS3 the raw API key lives inside
 * the stored providerSettings object. `getPublicProviderSettings` used to
 * spread the parsed settings verbatim into the runtime response, which
 * (a) leaked the raw key across the Service Worker boundary and (b) made
 * the popup / options leak check reject the whole payload - the user saw
 * "无法读取扩展配置" and the extension became unusable.
 */

function storedSettingsWithKey(): ProviderSettings {
  return {
    ...DEFAULT_PROVIDER_SETTINGS,
    model: 'qwen-plus',
    apiKey: 'sk-live-test-key',
    apiKeyByOrigin: { 'https://api.example.com': 'sk-origin-key' },
  };
}

describe('public provider settings boundary (TD-2026-028)', () => {
  it('buildPublicProviderSettings strips apiKey and apiKeyByOrigin', () => {
    const publicView = buildPublicProviderSettings(storedSettingsWithKey(), true);
    expect(publicView).not.toHaveProperty('apiKey');
    expect(publicView).not.toHaveProperty('apiKeyByOrigin');
    expect(publicView.hasApiKey).toBe(true);
    expect(publicView.model).toBe('qwen-plus');
  });

  it('the public view round-trips through parsePublicProviderSettings', () => {
    // This is the exact call the popup / options make on
    // GET_PROVIDER_SETTINGS. Before the fix the payload carried the raw
    // key and this parse threw '扩展返回的配置格式无效'.
    const publicView = buildPublicProviderSettings(storedSettingsWithKey(), true);
    expect(() => parsePublicProviderSettings(publicView)).not.toThrow();
    const parsed = parsePublicProviderSettings(publicView);
    expect(parsed.hasApiKey).toBe(true);
    expect(parsed).not.toHaveProperty('apiKey');
    expect(parsed).not.toHaveProperty('apiKeyByOrigin');
  });

  it('preserves hasApiKey=false when no key is configured', () => {
    const publicView = buildPublicProviderSettings(
      parseProviderSettings(DEFAULT_PROVIDER_SETTINGS),
      false,
    );
    expect(publicView.hasApiKey).toBe(false);
    expect(() => parsePublicProviderSettings(publicView)).not.toThrow();
  });

  it('the leak check still rejects a payload carrying the raw key', () => {
    // Defense in depth: if a future regression reintroduces the key into
    // the response, parsePublicProviderSettings must reject it outright
    // rather than silently stripping it.
    const leaked = { ...storedSettingsWithKey(), hasApiKey: true };
    expect(() => parsePublicProviderSettings(leaked)).toThrow('扩展返回的配置格式无效');
  });
});
