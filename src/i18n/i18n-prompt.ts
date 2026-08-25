// i18n translation prompt template for user locales.
//
// Single source of truth for what we send to the user's model when
// translating the TextDuet UI dictionary. Bumping I18N_PROMPT_VERSION
// in types.ts invalidates all previously cached user locales so the
// prompt is always matched against what it was written for.

import { I18N_PROMPT_VERSION } from './types';

export const I18N_TRANSLATION_PROMPT = `You are translating a browser extension UI from Simplified Chinese to {TARGET_LOCALE} (BCP-47: {TARGET_TAG}).

Rules (strict):
- Return ONLY a JSON object. No commentary, no Markdown fences, no trailing text.
- The JSON object must map every input "key" to its translation in {TARGET_LOCALE}.
- Preserve placeholders verbatim: any {name} substring (e.g. {input}, {output}, {percent}, {count}, {amount}, {today}, {name}, {current}, {total}, {hit}, {fragments}) must appear unchanged in the translation.
- Keep these proper nouns in English (do NOT translate): TextDuet, API Key, BYOK, Provider, Origin, Popup, Options, Auto, model, token, manifest, locale, prompt, batch.
- Currency codes (USD, CNY, EUR) and language code literals (zh-CN, en) stay as-is.
- Match the source register: UI labels are short (1-6 words), error messages can be longer.
- If a translation needs gender / plural agreement, use the {TARGET_LOCALE} default form.
- For an English target, prefer concise US English.
- For a Chinese target variant (e.g. zh-TW), use the appropriate regional vocabulary (e.g. 繁體中文 uses 翻譯 / 設定 / 選項, not 翻译 / 设置 / 选项).

The user has explicitly chosen {TARGET_LOCALE} as the extension UI language. Their model is the source of truth for terminology; do not second-guess the proper-noun list.`;

export interface I18nBatchInput {
  targetTag: string;
  targetLocale: string;
  sourceBatch: Record<string, string>;
}

export function buildI18nBatchPrompt(input: I18nBatchInput): { system: string; user: string } {
  const system = I18N_TRANSLATION_PROMPT
    .replace(/\{TARGET_LOCALE\}/g, input.targetLocale)
    .replace(/\{TARGET_TAG\}/g, input.targetTag);

  const lines: string[] = [
    `target_locale: ${input.targetLocale}`,
    `target_tag: ${input.targetTag}`,
    `prompt_version: ${I18N_PROMPT_VERSION}`,
    '',
    'Translate each line below. Return one JSON object mapping key to translation.',
    '',
  ];
  for (const [key, value] of Object.entries(input.sourceBatch)) {
    lines.push(`${key}\t${value}`);
  }
  const user = lines.join('\n');
  return { system, user };
}
