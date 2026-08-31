/**
 * Per-page translation memory.
 *
 * This module intentionally owns only a single Translator Script run. The
 * content-script boundary must not read extension storage or exchange cached
 * translations with other tabs: trusted Service Worker code owns those
 * operations and its encrypted persistent cache. Keeping L1/L2 here still
 * avoids repeat requests while a dynamic page is being observed.
 */

import { contentHash } from './content-hash';
import type { TranslatedBlock } from '@/src/core/contracts';

/**
 * A cached block belongs to the source request that first produced it. Its
 * `id` is therefore not reusable for a newly collected DOM candidate. Keep
 * the validated translation payload, but bind it to the current candidate
 * before passing it to the renderer, which intentionally joins by id.
 */
export function bindCachedTranslation(
  cached: TranslatedBlock,
  candidateId: string,
): TranslatedBlock {
  return { ...cached, id: candidateId };
}

export class TranslationMemory {
  /**
   * Keep the request key beside the block. DOM nodes are routinely reused by
   * SPA renderers, so an element reference alone is not a valid cache key.
   */
  private byElement = new WeakMap<HTMLElement, ElementEntry>();
  private readonly byContent = new Map<string, TranslatedBlock>();

  async get(
    text: string,
    targetLanguage: string,
    modelHint: string,
    element?: HTMLElement,
  ): Promise<TranslatedBlock | null> {
    const key = await contentHash(text, targetLanguage, modelHint);
    if (element) {
      const directHit = this.byElement.get(element);
      if (directHit?.key === key) return directHit.block;
      // The node was reused for a different source request. Drop the stale
      // L1 entry before consulting L2 so it cannot be observed again.
      if (directHit) this.byElement.delete(element);
    }

    const contentHit = this.byContent.get(key);
    if (!contentHit) return null;
    if (element) this.byElement.set(element, { key, block: contentHit });
    return contentHit;
  }

  async put(
    text: string,
    targetLanguage: string,
    modelHint: string,
    block: TranslatedBlock,
    element?: HTMLElement,
  ): Promise<void> {
    const key = await contentHash(text, targetLanguage, modelHint);
    this.byContent.set(key, block);
    if (element) this.byElement.set(element, { key, block });
  }

  dispose(): void {
    // WeakMap has no clear() method. Replace it so retained DOM references
    // cannot keep serving entries after the page-run memory is disposed.
    this.byElement = new WeakMap<HTMLElement, ElementEntry>();
    this.byContent.clear();
  }

  /** Visible to focused Translator Script tests. */
  get l2Size(): number {
    return this.byContent.size;
  }
}

interface ElementEntry {
  key: string;
  block: TranslatedBlock;
}
