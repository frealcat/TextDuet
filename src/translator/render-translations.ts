import type { TranslatedBlock, TranslationBlock } from '@/src/core/contracts';
import { resolveReadableTranslationColor } from '@/src/core/translation-colors';
import {
  SOURCE_CLASS,
  TRANSLATION_CLASS,
} from './page-status';

/** Inserts validated model output as text while preserving the source element. */
export function renderTranslations(
  candidates: Array<TranslationBlock & { element: HTMLElement }>,
  translations: TranslatedBlock[],
  targetLanguage: string,
): void {
  const candidatesById = new Map(candidates.map((candidate) => [candidate.id, candidate]));

  for (const translation of translations) {
    const sourceBlock = candidatesById.get(translation.id);
    if (!sourceBlock) continue;
    const sourceElement = sourceBlock.element;
    ensureSourceWrapper(sourceElement);
    const existing = sourceElement.querySelector<HTMLElement>(`:scope > .${TRANSLATION_CLASS}`);
    const translatedElement = existing || document.createElement('span');
    translatedElement.className = TRANSLATION_CLASS;
    translatedElement.lang = targetLanguage;
    translatedElement.textContent = translation.translatedText;
    if (sourceBlock.styleContext) {
      translatedElement.style.setProperty(
        'color',
        // A model response must never make adjacent translations use different
        // configured colors. The deterministic guard only falls back when the
        // user-selected color is genuinely unreadable on this block.
        resolveReadableTranslationColor(sourceBlock.styleContext, 'preferred'),
        'important',
      );
    } else {
      translatedElement.style.removeProperty('color');
    }
    if (!existing) sourceElement.append(translatedElement);
  }
}

export function removeRenderedTranslations(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>(`.${TRANSLATION_CLASS}`).forEach((element) => element.remove());
  root.querySelectorAll<HTMLElement>(`.${SOURCE_CLASS}`).forEach((wrapper) => {
    const parent = wrapper.parentNode;
    if (!parent) return;
    while (wrapper.firstChild) parent.insertBefore(wrapper.firstChild, wrapper);
    wrapper.remove();
  });
}

function ensureSourceWrapper(sourceElement: HTMLElement): void {
  if (sourceElement.querySelector(`:scope > .${SOURCE_CLASS}`)) return;
  const sourceWrapper = document.createElement('span');
  sourceWrapper.className = SOURCE_CLASS;
  const originalNodes = [...sourceElement.childNodes].filter(
    (node) => !(node instanceof HTMLElement && node.classList.contains(TRANSLATION_CLASS)),
  );
  originalNodes.forEach((node) => sourceWrapper.append(node));
  sourceElement.insertBefore(sourceWrapper, sourceElement.firstChild);
}
