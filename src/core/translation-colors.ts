export function isSupportedTranslationColor(value: string): boolean {
  const normalized = value.trim();
  if (/^#[\da-f]{3,4}$/i.test(normalized) || /^#[\da-f]{6}(?:[\da-f]{2})?$/i.test(normalized)) {
    return true;
  }

  const match = normalized.match(
    /^(rgb|rgba)\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(0(?:\.\d+)?|1(?:\.0+)?|\.\d+))?\s*\)$/i,
  );
  if (!match) return false;
  const [, kind, red, green, blue, alpha] = match;
  if (!kind || !red || !green || !blue) return false;
  const channelsAreValid = [red, green, blue].every((channel) => Number(channel) <= 255);
  if (!channelsAreValid) return false;
  return kind.toLowerCase() === 'rgba'
    ? alpha !== undefined && Number(alpha) >= 0 && Number(alpha) <= 1
    : alpha === undefined;
}

export interface RgbaColor {
  red: number;
  green: number;
  blue: number;
  alpha: number;
}

export interface TranslationStyleContext {
  sourceColor: string;
  preferredColor: string;
  backgroundColor: string;
  minimumContrast: number;
  sourceContrast: number;
  preferredContrast: number;
}

export type TranslationColorPreference = 'preferred' | 'source';

/** Parses the deliberately small color syntax accepted by extension settings and style metadata. */
export function parseTranslationColor(value: string): RgbaColor | null {
  const normalized = value.trim().toLowerCase();
  const hexadecimal = normalized.match(/^#([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i);
  if (hexadecimal?.[1]) {
    const expanded = hexadecimal[1].length <= 4
      ? hexadecimal[1].split('').map((digit) => digit + digit).join('')
      : hexadecimal[1];
    return {
      red: Number.parseInt(expanded.slice(0, 2), 16),
      green: Number.parseInt(expanded.slice(2, 4), 16),
      blue: Number.parseInt(expanded.slice(4, 6), 16),
      alpha: expanded.length === 8 ? Number.parseInt(expanded.slice(6, 8), 16) / 255 : 1,
    };
  }

  const functional = normalized.match(
    /^(rgb|rgba)\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(0(?:\.\d+)?|1(?:\.0+)?|\.\d+))?\s*\)$/i,
  );
  if (!functional) return null;
  const [, kind, red, green, blue, alpha] = functional;
  if (!kind || !red || !green || !blue) return null;
  const channels = [red, green, blue].map(Number);
  if (channels.some((channel) => channel > 255)) return null;
  if (kind === 'rgba' && alpha === undefined) return null;
  if (kind === 'rgb' && alpha !== undefined) return null;
  return {
    red: channels[0] || 0,
    green: channels[1] || 0,
    blue: channels[2] || 0,
    alpha: alpha === undefined ? 1 : Number(alpha),
  };
}

export function compositeColors(foreground: RgbaColor, background: RgbaColor): RgbaColor {
  const alpha = foreground.alpha + background.alpha * (1 - foreground.alpha);
  if (alpha === 0) return { red: 0, green: 0, blue: 0, alpha: 0 };
  return {
    red: (foreground.red * foreground.alpha
      + background.red * background.alpha * (1 - foreground.alpha)) / alpha,
    green: (foreground.green * foreground.alpha
      + background.green * background.alpha * (1 - foreground.alpha)) / alpha,
    blue: (foreground.blue * foreground.alpha
      + background.blue * background.alpha * (1 - foreground.alpha)) / alpha,
    alpha,
  };
}

export function getContrastRatio(foreground: string, background: string): number {
  const foregroundColor = parseTranslationColor(foreground);
  const backgroundColor = parseTranslationColor(background);
  if (!foregroundColor || !backgroundColor) return 1;
  const opaqueBackground = compositeColors(backgroundColor, {
    red: 255,
    green: 255,
    blue: 255,
    alpha: 1,
  });
  const opaqueForeground = compositeColors(foregroundColor, opaqueBackground);
  const foregroundLuminance = relativeLuminance(opaqueForeground);
  const backgroundLuminance = relativeLuminance(opaqueBackground);
  return (Math.max(foregroundLuminance, backgroundLuminance) + 0.05)
    / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
}

export function createTranslationStyleContext(
  sourceColor: string,
  preferredColor: string,
  backgroundColor: string,
  minimumContrast: number,
): TranslationStyleContext {
  return {
    sourceColor,
    preferredColor,
    backgroundColor,
    minimumContrast,
    sourceContrast: roundContrast(getContrastRatio(sourceColor, backgroundColor)),
    preferredContrast: roundContrast(getContrastRatio(preferredColor, backgroundColor)),
  };
}

/** Applies the model's restricted choice only after a deterministic contrast safety check. */
export function resolveReadableTranslationColor(
  context: TranslationStyleContext,
  modelPreference?: TranslationColorPreference,
): string {
  const preferredIsReadable = context.preferredContrast >= context.minimumContrast;
  const sourceIsReadable = context.sourceContrast >= context.minimumContrast;

  if (modelPreference === 'source' && sourceIsReadable) return context.sourceColor;
  if (modelPreference === 'preferred' && preferredIsReadable) return context.preferredColor;
  if (preferredIsReadable) return context.preferredColor;
  if (sourceIsReadable) return context.sourceColor;

  const blackContrast = getContrastRatio('#000000', context.backgroundColor);
  const whiteContrast = getContrastRatio('#ffffff', context.backgroundColor);
  return blackContrast >= whiteContrast ? '#000000' : '#ffffff';
}

export function serializeRgbColor(color: RgbaColor): string {
  const channels = [color.red, color.green, color.blue].map((channel) =>
    Math.round(Math.min(255, Math.max(0, channel))));
  if (color.alpha >= 0.999) return `rgb(${channels.join(', ')})`;
  return `rgba(${channels.join(', ')}, ${Math.round(color.alpha * 1_000) / 1_000})`;
}

function relativeLuminance(color: RgbaColor): number {
  const [red, green, blue] = [color.red, color.green, color.blue].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return (red || 0) * 0.2126 + (green || 0) * 0.7152 + (blue || 0) * 0.0722;
}

function roundContrast(value: number): number {
  return Math.round(value * 100) / 100;
}
