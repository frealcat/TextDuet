import { describe, expect, it } from 'vitest';
import {
  createCompatibilityDiagnostic,
  serializeCompatibilityDiagnostic,
} from '@/src/core/compatibility-diagnostics';

const baseInput = {
  generatedAt: '2026-08-18T05:30:00.000Z',
  extensionVersion: '0.1.0',
  chromeVersion: '151.0.7922.34',
  hostname: 'www.example.com',
  pathname: '/private/article?token=do-not-export#section',
  candidateCount: 12,
  translatedCount: 10,
  failedBatchCount: 1,
  issueType: 'missed-content' as const,
  errorCode: 'network-timeout',
  screenshotIncluded: false,
};

describe('compatibility diagnostics', () => {
  it('redacts path by default and contains only safe metrics', () => {
    const diagnostic = createCompatibilityDiagnostic(baseInput);
    const serialized = serializeCompatibilityDiagnostic(diagnostic);

    expect(diagnostic.page).toEqual({ hostname: 'example.com' });
    expect(serialized).not.toContain('private');
    expect(serialized).not.toContain('token=');
    expect(serialized).not.toContain('sourceText');
    expect(serialized).toContain('network-timeout');
  });

  it('includes only the pathname when the user explicitly opts in', () => {
    const diagnostic = createCompatibilityDiagnostic({ ...baseInput, includePath: true });

    expect(diagnostic.page).toEqual({
      hostname: 'example.com',
      pathname: '/private/article',
    });
  });

  it('rejects URLs, invalid counters, and unsafe error codes', () => {
    expect(() => createCompatibilityDiagnostic({ ...baseInput, hostname: 'https://example.com' }))
      .toThrow('主机名无效');
    expect(() => createCompatibilityDiagnostic({ ...baseInput, candidateCount: -1 }))
      .toThrow('candidateCount');
    expect(() => createCompatibilityDiagnostic({ ...baseInput, errorCode: 'api key' }))
      .toThrow('错误码无效');
  });
});
