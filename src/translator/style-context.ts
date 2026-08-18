import type { TranslationBlock } from '@/src/core/contracts';
import {
  compositeColors,
  createTranslationStyleContext,
  parseTranslationColor,
  serializeRgbColor,
} from '@/src/core/translation-colors';

const OPAQUE_WHITE = { red: 255, green: 255, blue: 255, alpha: 1 };

export function collectStyleContext(
  element: HTMLElement,
  preferredColor: string,
): NonNullable<TranslationBlock['styleContext']> | undefined {
  const view = element.ownerDocument.defaultView;
  if (!view) return undefined;
  const computed = view.getComputedStyle(element);
  const sourceColor = normalizeComputedColor(computed.color);
  const normalizedPreferred = normalizeComputedColor(preferredColor);
  if (!sourceColor || !normalizedPreferred) return undefined;
  const backgroundColor = resolveEffectiveBackgroundColor(element);
  const fontSize = Number.parseFloat(computed.fontSize);
  const fontWeight = Number.parseInt(computed.fontWeight, 10);
  const isLargeText = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
  return createTranslationStyleContext(
    sourceColor,
    normalizedPreferred,
    backgroundColor,
    isLargeText ? 3 : 4.5,
  );
}

export function resolveEffectiveBackgroundColor(element: HTMLElement): string {
  const view = element.ownerDocument.defaultView;
  let accumulated = { red: 0, green: 0, blue: 0, alpha: 0 };
  let current: HTMLElement | null = element;

  while (current && view && accumulated.alpha < 0.999) {
    const layer = parseTranslationColor(view.getComputedStyle(current).backgroundColor);
    if (layer && layer.alpha > 0) accumulated = compositeColors(accumulated, layer);
    current = current.parentElement;
  }

  return serializeRgbColor(compositeColors(accumulated, OPAQUE_WHITE));
}

function normalizeComputedColor(value: string): string | null {
  const parsed = parseTranslationColor(value);
  return parsed ? serializeRgbColor(parsed) : null;
}
