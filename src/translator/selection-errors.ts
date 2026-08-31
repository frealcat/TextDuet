/*
 * SPDX-FileCopyrightText: Copyright 2026 frealcat
 * SPDX-License-Identifier: Apache-2.0
 */

export type TranslateSelectionMessage = (key: string) => string;

/**
 * Maps safe, user-actionable selection failures to the active UI locale.
 * Provider and Service Worker errors cross a message boundary as plain Error
 * objects, so consent detection accepts both the stable error name and the
 * current localized fallback message.
 */
export function normalizeSelectionError(
  error: unknown,
  translate: TranslateSelectionMessage,
): string {
  const message = error instanceof Error ? error.message : '';
  const name = error && typeof error === 'object' && 'name' in error
    ? String((error as { name?: unknown }).name || '')
    : '';
  if (name === 'TranslationConsentRequiredError' || /consent|privacy confirmation|首次发送网页文本前需要确认|确认.*隐私/i.test(`${name} ${message}`)) {
    return translate('translator.selection.error.consent');
  }
  if (/api key|密钥|认证/i.test(message)) return translate('translator.selection.error.apiKey');
  if (/过长|4000|长度/i.test(message)) return translate('translator.selection.error.tooLong');
  if (/格式|json|段落/i.test(message)) return translate('translator.selection.error.format');
  if (/余额|限流|不可用/i.test(message)) return message.slice(0, 80);
  return translate('translator.selection.error.generic');
}
