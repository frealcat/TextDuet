/*
 * SPDX-FileCopyrightText: Copyright 2026 frealcat
 * SPDX-License-Identifier: Apache-2.0
 */

import { storage } from '#imports';

/**
 * Bump this value whenever the user-visible data-flow disclosure changes.
 * The value is intentionally opaque and contains no page, provider, or key
 * data. A new value asks the user to confirm again on the next cache miss.
 */
export const TRANSLATION_CONSENT_VERSION = '2026-08-v1';

const translationConsentStorage = storage.defineItem<string | null>(
  'local:textduet.translationConsentVersion',
  { fallback: null },
);

export interface TranslationConsentStatus {
  isConfirmed: boolean;
  version: string | null;
}

export async function getTranslationConsent(): Promise<TranslationConsentStatus> {
  const version = await translationConsentStorage.getValue();
  return {
    isConfirmed: version === TRANSLATION_CONSENT_VERSION,
    version: typeof version === 'string' && version.length > 0 ? version : null,
  };
}

export async function hasTranslationConsent(): Promise<boolean> {
  const status = await getTranslationConsent();
  return status.isConfirmed;
}

export async function confirmTranslationConsent(): Promise<TranslationConsentStatus> {
  await translationConsentStorage.setValue(TRANSLATION_CONSENT_VERSION);
  return {
    isConfirmed: true,
    version: TRANSLATION_CONSENT_VERSION,
  };
}

export async function clearTranslationConsent(): Promise<void> {
  await translationConsentStorage.removeValue({ removeMeta: true });
}
