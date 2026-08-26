/**
 * Content-addressable hash for translation cache keys (TD-2026-026 Layer 3).
 *
 * The cache key is `sha256(text + targetLang + modelHint)` so that the
 * same source text in the same target language always hashes to the
 * same value, regardless of the page element that produced it. This
 * lets the Layer 5 Translation Memory share translations across runs
 * (e.g. the same post re-translated after a SPA navigation reuses
 * the previous answer without hitting the model).
 *
 * We use SHA-256 via `crypto.subtle` because it is built into Chrome
 * MV3, the runtime contract forbids new dependencies, and the same
 * `SubtleCrypto` API exists in node for tests.
 *
 * Normalisation rules (must remain stable for cache key compatibility):
 *   1. Strip leading and trailing whitespace.
 *   2. Collapse internal runs of whitespace to a single space.
 *   3. NFC-normalize unicode so equivalent composed / decomposed forms
 *      hash to the same value (`é` and `é` should match).
 *   4. Lowercase is NOT applied — translation is case-sensitive in
 *      most target languages.
 *
 * Returns the lowercase-hex SHA-256 digest of `text + '|' + lang + '|' + model`.
 */
export async function contentHash(
  text: string,
  lang: string,
  modelHint: string = '',
): Promise<string> {
  const normalised = normaliseText(text);
  const payload = `${normalised}|${lang}|${modelHint}`;
  const subtle = resolveSubtleCrypto();
  if (subtle) {
    const bytes = new TextEncoder().encode(payload);
    const digest = await subtle.digest('SHA-256', bytes);
    return bytesToHex(new Uint8Array(digest));
  }
  // SubtleCrypto is unavailable in non-secure contexts (e.g. plain
  // HTTP localhost or some test environments). Fall back to a
  // synchronous JS hash so the rest of the pipeline still works; the
  // value is stable per input so cache keys remain correct within
  // a single browser session.
  return fallbackHash(payload);
}

function normaliseText(text: string): string {
  return text
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveSubtleCrypto(): SubtleCrypto | null {
  if (typeof globalThis === 'undefined') return null;
  const crypto = (globalThis as { crypto?: { subtle?: SubtleCrypto } }).crypto;
  return crypto?.subtle ?? null;
}

function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) {
    const byte = bytes[i] ?? 0;
    out += byte.toString(16).padStart(2, '0');
  }
  return out;
}

/**
 * FNV-1a 32-bit hash. Stable per input (same input => same output)
 * within a single process; used only when `crypto.subtle` is not
 * available. Not collision-resistant enough for security use, but the
 * cache key space is small enough (one bucket per actual translation
 * request) that collisions are rare and harmless.
 */
function fallbackHash(payload: string): string {
  // FNV-1a 32-bit, xored 8 times for 256 bits of output.
  const FNV_OFFSET = 0x811c9dc5;
  const FNV_PRIME = 0x01000193;
  const parts: number[] = [FNV_OFFSET, FNV_OFFSET, FNV_OFFSET, FNV_OFFSET, FNV_OFFSET, FNV_OFFSET, FNV_OFFSET, FNV_OFFSET];
  for (let i = 0; i < payload.length; i += 1) {
    const code = payload.charCodeAt(i);
    for (let part = 0; part < parts.length; part += 1) {
      let hash = (parts[part] ?? FNV_OFFSET) ^ code;
      hash = Math.imul(hash, FNV_PRIME);
      parts[part] = hash >>> 0;
    }
  }
  return parts.map((part) => part.toString(16).padStart(8, '0')).join('');
}
