import { resolveReadableTranslationColor } from '@/src/core/translation-colors';
import type { TranslatedBlock } from '@/src/core/contracts';
import { collectStyleContext } from './style-context';
import {
  SELECTION_ERROR_CLASS,
  SELECTION_TRANSLATION_CLASS,
} from './page-status';

const SELECTION_ANCHOR_SELECTOR = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'blockquote', 'td', 'figcaption',
  'header a', 'header p', 'header li', 'nav a', '[role="navigation"] a',
  'footer a', 'footer p', 'footer li',
].join(', ');
const SELECTION_BLOCK_FALLBACK_SELECTOR = [
  'article', 'main', 'section', 'div', 'header', 'nav', 'footer', 'body',
].join(', ');
const SELECTION_EXCLUDED_SELECTOR = [
  'script', 'style', 'noscript', 'code', 'pre', 'textarea', 'input', 'select', 'button', 'form',
  '[contenteditable]:not([contenteditable="false"])', '[aria-hidden="true"]', '[hidden]', '[inert]',
].join(', ');
interface SelectionSnapshot {
  anchor: HTMLElement;
  text: string;
  range: Range;
  revision: number;
}

let currentSelection: SelectionSnapshot | null = null;
let selectionRevision = 0;

export function captureSelectionAnchor(): HTMLElement | null {
  selectionRevision += 1;
  const selection = window.getSelection();
  const anchor = findSelectionAnchor(selection?.anchorNode || null);
  if (!selection || selection.rangeCount === 0 || !anchor) {
    currentSelection = null;
    return null;
  }
  currentSelection = {
    anchor,
    text: normalizeSelectionText(selection.toString()),
    range: selection.getRangeAt(0).cloneRange(),
    revision: selectionRevision,
  };
  return anchor;
}

export function renderSelectionTranslation(
  text: string,
  translated: TranslatedBlock,
  targetLanguage: string,
  preferredColor?: string,
): void {
  const snapshot = currentSelection;
  const anchor = snapshot?.anchor || findSelectionAnchor(null);
  if (!anchor) throw new Error('无法定位选中文本');
  const paragraph = getParagraph(anchor);
  const host = getInsertionHost(paragraph);
  host.parentElement?.querySelector(`:scope > .${SELECTION_TRANSLATION_CLASS}`)?.remove();
  const element = document.createElement('span');
  element.className = SELECTION_TRANSLATION_CLASS;
  element.lang = targetLanguage;
  element.textContent = translated.translatedText;
  element.style.display = 'block';
  element.style.marginTop = '0.35em';
  const styleContext = collectStyleContext(paragraph, preferredColor || getComputedStyle(paragraph).color);
  if (styleContext) {
    element.style.setProperty(
      'color',
      resolveReadableTranslationColor(styleContext, 'preferred'),
      'important',
    );
  }
  insertAfterHost(host, element);
}

export function renderSelectionError(message: string): void {
  const anchor = currentSelection?.anchor || findSelectionAnchor(null);
  if (!anchor) return;
  const paragraph = getParagraph(anchor);
  const host = getInsertionHost(paragraph);
  host.parentElement?.querySelector(`:scope > .${SELECTION_ERROR_CLASS}`)?.remove();
  const element = document.createElement('span');
  element.className = SELECTION_ERROR_CLASS;
  element.textContent = `TextDuet：${message}`;
  element.style.display = 'block';
  element.style.marginTop = '0.35em';
  element.style.color = '#9b2c2c';
  insertAfterHost(host, element);
  window.setTimeout(() => element.remove(), 5_000);
}

export function getSelectedText(): string {
  return normalizeSelectionText(window.getSelection()?.toString() || '');
}

export function getCapturedSelection(): { anchor: HTMLElement; text: string; revision: number } | null {
  return currentSelection
    ? {
        anchor: currentSelection.anchor,
        text: currentSelection.text,
        revision: currentSelection.revision,
      }
    : null;
}

function findSelectionAnchor(node: Node | null): HTMLElement | null {
  const element = node instanceof HTMLElement ? node : node?.parentElement;
  if (!element) return null;
  if (element.closest(SELECTION_EXCLUDED_SELECTOR)) return null;
  return element.closest<HTMLElement>(SELECTION_ANCHOR_SELECTOR)
    || element.closest<HTMLElement>(SELECTION_BLOCK_FALLBACK_SELECTOR)
    || null;
}

function getParagraph(anchor: HTMLElement): HTMLElement {
  return anchor.closest<HTMLElement>(SELECTION_ANCHOR_SELECTOR)
    || anchor.closest<HTMLElement>(SELECTION_BLOCK_FALLBACK_SELECTOR)
    || anchor;
}

function getInsertionHost(paragraph: HTMLElement): HTMLElement {
  return paragraph.tagName === 'TD' ? paragraph : paragraph;
}

function insertAfterHost(host: HTMLElement, element: HTMLElement): void {
  if (host.tagName === 'TD') {
    host.append(element);
    return;
  }
  host.insertAdjacentElement('afterend', element);
}

function normalizeSelectionText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}
