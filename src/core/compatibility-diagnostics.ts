export const COMPATIBILITY_DIAGNOSTIC_SCHEMA_VERSION = 1;

export type CompatibilityIssueType =
  | 'missed-content'
  | 'wrong-content'
  | 'duplicate-translation'
  | 'layout'
  | 'dynamic-content'
  | 'performance'
  | 'other';

export interface CompatibilityDiagnosticInput {
  generatedAt: string;
  extensionVersion: string;
  chromeVersion: string;
  hostname: string;
  pathname?: string;
  includePath?: boolean;
  candidateCount: number;
  translatedCount: number;
  failedBatchCount: number;
  issueType: CompatibilityIssueType;
  errorCode?: string;
  screenshotIncluded: boolean;
}

export interface CompatibilityDiagnostic {
  schemaVersion: typeof COMPATIBILITY_DIAGNOSTIC_SCHEMA_VERSION;
  generatedAt: string;
  extensionVersion: string;
  chromeVersion: string;
  page: {
    hostname: string;
    pathname?: string;
  };
  metrics: {
    candidateCount: number;
    translatedCount: number;
    failedBatchCount: number;
  };
  issue: {
    type: CompatibilityIssueType;
    errorCode?: string;
  };
  screenshotIncluded: boolean;
}

/** Creates a local diagnostic without accepting URLs, source text, or credentials. */
export function createCompatibilityDiagnostic(
  input: CompatibilityDiagnosticInput,
): CompatibilityDiagnostic {
  const hostname = normalizeHostname(input.hostname);
  const diagnostic: CompatibilityDiagnostic = {
    schemaVersion: COMPATIBILITY_DIAGNOSTIC_SCHEMA_VERSION,
    generatedAt: input.generatedAt,
    extensionVersion: limitText(input.extensionVersion, 64, 'extensionVersion'),
    chromeVersion: limitText(input.chromeVersion, 64, 'chromeVersion'),
    page: { hostname },
    metrics: {
      candidateCount: requireNonNegativeInteger(input.candidateCount, 'candidateCount'),
      translatedCount: requireNonNegativeInteger(input.translatedCount, 'translatedCount'),
      failedBatchCount: requireNonNegativeInteger(input.failedBatchCount, 'failedBatchCount'),
    },
    issue: {
      type: input.issueType,
    },
    screenshotIncluded: input.screenshotIncluded,
  };

  if (input.includePath && input.pathname) {
    diagnostic.page.pathname = normalizePathname(input.pathname);
  }
  if (input.errorCode) {
    diagnostic.issue.errorCode = normalizeErrorCode(input.errorCode);
  }
  return diagnostic;
}

export function serializeCompatibilityDiagnostic(
  diagnostic: CompatibilityDiagnostic,
): string {
  return JSON.stringify(diagnostic, null, 2);
}

function normalizeHostname(value: string): string {
  const hostname = value.trim().toLowerCase().replace(/^www\./, '');
  if (!hostname || hostname.length > 253 || hostname.includes('/') || hostname.includes('@')) {
    throw new Error('诊断包主机名无效');
  }
  return hostname;
}

function normalizePathname(value: string): string {
  const pathname = value.trim().split(/[?#]/, 1)[0] || '/';
  if (!pathname.startsWith('/') || pathname.length > 1_024) {
    throw new Error('诊断包路径无效');
  }
  return pathname;
}

function normalizeErrorCode(value: string): string {
  const code = value.trim().toLowerCase();
  if (!/^[a-z0-9-]{1,64}$/.test(code)) {
    throw new Error('诊断包错误码无效');
  }
  return code;
}

function limitText(value: string, maxLength: number, field: string): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    throw new Error(`诊断包 ${field} 无效`);
  }
  return normalized;
}

function requireNonNegativeInteger(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`诊断包 ${field} 无效`);
  }
  return value;
}
