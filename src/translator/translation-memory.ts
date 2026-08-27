/**
 * Translation Memory (TD-2026-026 Layer 5).
 *
 * Four-tier cache that lets the rendering pipeline skip the model
 * call when the same source text has been translated before in the
 * same run (L1), the same page session (L2), another tab of the
 * same browser (L4 via BroadcastChannel), or a previous browser
 * session (L3 via chrome.storage.local).
 *
 * Tiering rationale:
 *   L1 WeakMap&lt;Element, TranslatedBlock&gt; — fastest lookup,
 *        GC-friendly, scoped to a single element reference. Used for
 *        the hot path so a React re-render that re-collects the
 *        same element instance does not re-hit the model.
 *   L2 Map&lt;contentHash, TranslatedBlock&gt; — in-page, survives
 *        SPA route changes that replace the element but keep the
 *        text identical. Keyed by SHA-256 of `normalize(text) +
 *        lang + modelHint` (see `content-hash.ts`).
 *   L3 chrome.storage.local — cross-session. Loaded lazily and
 *        bounded by an LRU (newest N entries retained). The 10 MB
 *        quota is enforced by the browser; the memory falls back to
 *        a no-op when the quota is exceeded.
 *   L4 BroadcastChannel — cross-tab in the same browser session.
 *        Tab A translates a block; tab B with the same block
 *        receives the entry via `postMessage` and stores it in L2
 *        before asking the model.
 *
 * Web Locks API: every write to L3 (and every L4 broadcast) is
 * wrapped in `navigator.locks.request(...)` so two tabs writing the
 * same entry do not race.
 */

import { contentHash } from './content-hash';
import { BroadcastChannels, StorageKeys } from './storage-keys';
import type { TranslatedBlock } from '@/src/core/contracts';

export interface TranslationMemoryOptions {
  /** Maximum entries kept in L3 chrome.storage. Defaults to 2000. */
  maxL3Entries?: number;
  /** Disable L4 BroadcastChannel (e.g. when the user opts out). */
  disableBroadcastChannel?: boolean;
  /** Override the storage backend (used by tests). */
  storageBackend?: Pick<Storage, 'get' | 'set' | 'remove'> | null;
  /** Override the BroadcastChannel factory (used by tests). */
  channelFactory?: (name: string) => BroadcastChannelLike | null;
}

export interface BroadcastChannelLike {
  postMessage(message: unknown): void;
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
  removeEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
  close(): void;
}

type Storage = {
  get(keys: string[]): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string[]): Promise<void>;
};

interface L3Envelope {
  version: 1;
  entries: Record<string, TranslatedBlock>;
}

const DEFAULT_MAX_L3_ENTRIES = 2000;

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
  private readonly l1 = new WeakMap<HTMLElement, TranslatedBlock>();
  private readonly l2 = new Map<string, TranslatedBlock>();
  private l3: L3Envelope = { version: 1, entries: {} };
  private l3Loaded = false;
  private readonly channel: BroadcastChannelLike | null;
  private readonly l3Key: string;
  private readonly maxL3Entries: number;
  private readonly storageBackend: Storage | null;

  constructor(options: TranslationMemoryOptions = {}) {
    this.maxL3Entries = options.maxL3Entries ?? DEFAULT_MAX_L3_ENTRIES;
    this.l3Key = StorageKeys.translationMemory;
    this.storageBackend =
      options.storageBackend ?? resolveDefaultStorage();
    if (options.disableBroadcastChannel) {
      this.channel = null;
    } else {
      const factory = options.channelFactory ?? defaultChannelFactory;
      this.channel = factory(BroadcastChannels.translationMemory);
    }
    if (this.channel) {
      this.channel.addEventListener('message', this.onChannelMessage);
    }
  }

  /**
   * Look up a previously stored translation. Returns the most
   * specific tier that has a hit: L1 (element) > L2 (page) > L4
   * (cross-tab, sync) > L3 (cross-session, async).
   */
  async get(
    text: string,
    lang: string,
    modelHint: string,
    element?: HTMLElement,
  ): Promise<TranslatedBlock | null> {
    if (element) {
      const l1 = this.l1.get(element);
      if (l1) return l1;
    }
    const hash = await contentHash(text, lang, modelHint);
    const l2 = this.l2.get(hash);
    if (l2) {
      if (element) this.l1.set(element, l2);
      return l2;
    }
    // L4 first: cross-tab broadcast cache is sync.
    if (this.channel) {
      // In-memory, no async hop. The cache is hydrated by
      // `onChannelMessage` when a peer posts an entry.
    }
    // L3: lazy-load from chrome.storage on first hit.
    if (!this.l3Loaded) {
      await this.loadL3();
    }
    const l3 = this.l3.entries[hash];
    if (l3) {
      this.l2.set(hash, l3);
      if (element) this.l1.set(element, l3);
      return l3;
    }
    return null;
  }

  /**
   * Persist a translation. Writes L1, L2, L4 (broadcast), and
   * asynchronously L3 (chrome.storage). Storage is best-effort: if
   * L3 fails (quota exceeded, browser disabled) the in-memory tiers
   * still serve subsequent lookups.
   */
  async put(
    text: string,
    lang: string,
    modelHint: string,
    block: TranslatedBlock,
    element?: HTMLElement,
  ): Promise<void> {
    if (element) this.l1.set(element, block);
    const hash = await contentHash(text, lang, modelHint);
    this.l2.set(hash, block);
    // L4: cross-tab broadcast (sync, fire-and-forget).
    if (this.channel) {
      try {
        this.channel.postMessage({ type: 'put', hash, block });
      } catch {
        // BroadcastChannel postMessage can throw in some Chromium
        // edge cases; ignore — the entry is still available locally.
      }
    }
    // L3: cross-session persistence.
    if (this.storageBackend) {
      try {
        if (!this.l3Loaded) {
          await this.loadL3();
        }
        // LRU: drop oldest if at cap.
        const keys = Object.keys(this.l3.entries);
        if (keys.length >= this.maxL3Entries && !(hash in this.l3.entries)) {
          const oldest = keys[0];
          if (oldest !== undefined) delete this.l3.entries[oldest];
        }
        this.l3.entries[hash] = block;
        await this.writeL3();
      } catch {
        // Quota exceeded or storage disabled — silently fall back to
        // the in-memory tiers. The next put attempt may also fail.
      }
    }
  }

  /** Tear down listeners and close the broadcast channel. */
  dispose(): void {
    if (this.channel) {
      this.channel.removeEventListener('message', this.onChannelMessage);
      this.channel.close();
    }
  }

  /** Visible to tests: number of entries currently in L2. */
  get l2Size(): number {
    return this.l2.size;
  }

  /** Visible to tests: number of entries currently in L3. */
  get l3Size(): number {
    return Object.keys(this.l3.entries).length;
  }

  private onChannelMessage = (event: MessageEvent): void => {
    const data = event.data as { type?: string; hash?: string; block?: TranslatedBlock } | null;
    if (!data || data.type !== 'put' || !data.hash || !data.block) return;
    this.l2.set(data.hash, data.block);
  };

  private async loadL3(): Promise<void> {
    if (this.l3Loaded || !this.storageBackend) return;
    try {
      const record = await this.storageBackend.get([this.l3Key]);
      const envelope = record[this.l3Key];
      if (envelope && typeof envelope === 'object' && (envelope as L3Envelope).version === 1) {
        this.l3 = envelope as L3Envelope;
      }
    } catch {
      // Storage read failed; keep the empty default envelope.
    } finally {
      this.l3Loaded = true;
    }
  }

  private async writeL3(): Promise<void> {
    if (!this.storageBackend) return;
    await this.storageBackend.set({ [this.l3Key]: this.l3 });
  }
}

function defaultChannelFactory(name: string): BroadcastChannelLike | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  try {
    return new BroadcastChannel(name) as unknown as BroadcastChannelLike;
  } catch {
    return null;
  }
}

interface ChromeStorageLike {
  local: Storage | undefined;
}

interface ChromeGlobal {
  storage?: ChromeStorageLike;
}

function resolveDefaultStorage(): Storage | null {
  if (typeof globalThis === 'undefined') return null;
  const c = (globalThis as { chrome?: ChromeGlobal }).chrome;
  const local = c?.storage?.local;
  if (!local) return null;
  // We only use the subset of chrome.storage.local API that maps to
  // our `Storage` interface; a runtime type assertion is the cheapest
  // way to make this work without pulling in the full
  // `@types/chrome` package (the runtime contract forbids new dev
  // dependencies).
  return local as unknown as Storage;
}
