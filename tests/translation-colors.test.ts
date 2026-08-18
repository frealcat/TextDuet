import { describe, expect, it } from 'vitest';
import {
  createTranslationStyleContext,
  getContrastRatio,
  isSupportedTranslationColor,
  parseTranslationColor,
  resolveReadableTranslationColor,
} from '@/src/core/translation-colors';

describe('translation colors', () => {
  it.each([
    '#186f5b',
    '#186f5bcc',
    '#abc',
    '#abcd',
    'rgb(24, 111, 91)',
    'rgba(24, 111, 91, 0.8)',
    'rgba(24, 111, 91, 1.0)',
  ])('accepts supported color: %s', (color) => {
    expect(isSupportedTranslationColor(color)).toBe(true);
  });

  it.each([
    'red',
    '#12',
    'rgb(999, 1, 1)',
    'rgb(1, 2, 3, 0.5)',
    'rgba(1, 2, 3)',
    'rgba(1, 2, 3, 1.2)',
    '#fff; background: red',
  ])('rejects unsupported color: %s', (color) => {
    expect(isSupportedTranslationColor(color)).toBe(false);
  });

  it('parses alpha colors and computes WCAG contrast against the effective background', () => {
    expect(parseTranslationColor('#ff000080')).toMatchObject({ red: 255, green: 0, blue: 0 });
    expect(getContrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(getContrastRatio('rgba(0, 0, 0, 0.5)', '#ffffff')).toBeGreaterThan(3.9);
  });

  it('rejects an unsafe preferred color even when the model selects it', () => {
    const context = createTranslationStyleContext(
      'rgb(23, 33, 30)',
      'rgb(255, 0, 0)',
      'rgb(249, 115, 22)',
      4.5,
    );

    expect(context.preferredContrast).toBeLessThan(4.5);
    expect(context.sourceContrast).toBeGreaterThanOrEqual(4.5);
    expect(resolveReadableTranslationColor(context, 'preferred')).toBe('rgb(23, 33, 30)');
  });

  it('honors the model source choice when both candidates are readable', () => {
    const context = createTranslationStyleContext('#111111', '#143d2f', '#ffffff', 4.5);
    expect(resolveReadableTranslationColor(context, 'source')).toBe('#111111');
  });
});
