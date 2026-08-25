// Locale store: a tiny event bus that lets React components subscribe
// to `currentLocale` / `userPreference` changes without pulling in
// React Context. Subscribers are notified once per microtask even if
// multiple fields change synchronously, so a single user action
// (e.g. picking a new language) only triggers one render pass per
// subscriber per microtask.

import type { LanguagePreference, Locale } from './types';

let currentLocale: Locale = 'zh-CN';
let userPreference: LanguagePreference = 'auto';

const listeners = new Set<() => void>();
let notifyScheduled = false;

export function getCurrentLocale(): Locale {
  return currentLocale;
}

export function getCurrentPreference(): LanguagePreference {
  return userPreference;
}

export function setLocaleFields(locale: Locale, preference: LanguagePreference): boolean {
  let changed = false;
  if (currentLocale !== locale) {
    currentLocale = locale;
    changed = true;
  }
  if (userPreference !== preference) {
    userPreference = preference;
    changed = true;
  }
  if (changed) scheduleNotify();
  return changed;
}

export function setLocaleOnly(locale: Locale): boolean {
  if (currentLocale === locale) return false;
  currentLocale = locale;
  scheduleNotify();
  return true;
}

export function setPreferenceOnly(preference: LanguagePreference): boolean {
  if (userPreference === preference) return false;
  userPreference = preference;
  scheduleNotify();
  return true;
}

export function subscribeToLocaleChanges(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Test hook: synchronously flush queued notifications. Production code
// never needs this; microtask coalescing is enough.
export function flushLocaleChangesForTest(): void {
  notifyScheduled = false;
  for (const listener of [...listeners]) listener();
}

function scheduleNotify(): void {
  if (notifyScheduled) return;
  notifyScheduled = true;
  queueMicrotask(() => {
    notifyScheduled = false;
    for (const listener of [...listeners]) listener();
  });
}
