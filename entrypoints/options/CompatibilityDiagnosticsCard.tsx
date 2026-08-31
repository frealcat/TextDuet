import { DownloadIcon, AlertIcon, RefreshIcon } from '@/src/icons';
import { useState } from 'react';
import type { CompatibilityDiagnostic, RuntimeMessage } from '@/src/core/contracts';
import {
  parseCompatibilityDiagnostic,
  parseOperationResult,
} from '@/src/core/schemas';
import { serializeCompatibilityDiagnostic } from '@/src/core/compatibility-diagnostics';
import { useTranslation } from '@/src/i18n';

const ISSUE_TYPES = [
  ['missed-content', 'diagnostics.issueType.missed'],
  ['wrong-content', 'diagnostics.issueType.wrongContent'],
  ['duplicate-translation', 'diagnostics.issueType.duplicateTranslation'],
  ['layout', 'diagnostics.issueType.layout'],
  ['dynamic-content', 'diagnostics.issueType.dynamicContent'],
  ['performance', 'diagnostics.issueType.performance'],
  ['other', 'diagnostics.issueType.other'],
] as const;

interface CompatibilityDiagnosticsCardProps {
  /** Optional DOM id, used by sidebar scroll anchors (TD-2026-025 P2). */
  id?: string;
}

export function CompatibilityDiagnosticsCard({ id }: CompatibilityDiagnosticsCardProps = {}) {
  const { t } = useTranslation();
  const [issueType, setIssueType] = useState<CompatibilityDiagnostic['issue']['type']>('other');
  const [includePath, setIncludePath] = useState(false);
  const [diagnostic, setDiagnostic] = useState<CompatibilityDiagnostic | null>(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  async function generateDiagnostic(): Promise<void> {
    setBusy(true);
    setStatus(t('diagnostics.status.reading'));
    try {
      const rawResult: unknown = await browser.runtime.sendMessage({
        type: 'GET_COMPATIBILITY_DIAGNOSTIC',
        includePath,
      } satisfies RuntimeMessage);
      let nextDiagnostic: CompatibilityDiagnostic;
      try {
        nextDiagnostic = parseCompatibilityDiagnostic(rawResult);
      } catch {
        parseOperationResult(rawResult);
        throw new Error();
      }
      setDiagnostic({
        ...nextDiagnostic,
        issue: { ...nextDiagnostic.issue, type: issueType },
      });
      setStatus(t('diagnostics.status.generated'));
    } catch {
      setDiagnostic(null);
      setStatus(t('diagnostics.status.failed'));
    } finally {
      setBusy(false);
    }
  }

  function updateIssueType(value: CompatibilityDiagnostic['issue']['type']): void {
    setIssueType(value);
    setDiagnostic((current) => current
      ? { ...current, issue: { ...current.issue, type: value } }
      : current);
  }

  function updatePathConsent(value: boolean): void {
    setIncludePath(value);
    setDiagnostic(null);
    setStatus(value
      ? t('diagnostics.status.pathIncluded')
      : t('diagnostics.status.pathExcluded'));
  }

  function downloadDiagnostic(): void {
    if (!diagnostic) return;
    const blob = new Blob([serializeCompatibilityDiagnostic(diagnostic)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `textduet-compatibility-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setStatus(t('diagnostics.status.downloaded'));
  }

  return (
    <section id={id} className="settings-card diagnostics-card" aria-labelledby="diagnostics-heading">
      <div className="section-heading">
        <div>
          <span className="step">07</span>
          <h2 id="diagnostics-heading">{t('diagnostics.section.title')}</h2>
        </div>
        <span className="badge">
          <AlertIcon size={14} />
          {t('diagnostics.section.badge')}
        </span>
      </div>

      <p className="cost-disclaimer">
        {t('diagnostics.disclaimer')}
      </p>

      <div className="diagnostic-controls">
        <label className="select-field">
          <span>{t('diagnostics.issueType.label')}</span>
          <select
            value={issueType}
            onChange={(event) => updateIssueType(event.target.value as CompatibilityDiagnostic['issue']['type'])}
          >
            {ISSUE_TYPES.map(([value, labelKey]) => (
              <option key={value} value={value}>{t(labelKey)}</option>
            ))}
          </select>
        </label>

        <label className="consent-check">
          <input
            type="checkbox"
            checked={includePath}
            onChange={(event) => updatePathConsent(event.target.checked)}
          />
          <span>
            <strong>{t('diagnostics.pathConsent.title')}</strong>
            <small>{t('diagnostics.pathConsent.hint')}</small>
          </span>
        </label>
      </div>

      <p className="diagnostic-screenshot-note">{t('diagnostics.screenshotNote')}</p>

      <div className="card-actions">
        <button className="secondary-button" type="button" onClick={generateDiagnostic} disabled={busy}>
          <RefreshIcon className={busy ? 'spin' : ''} size={14} />
          {busy ? t('diagnostics.action.processing') : t('diagnostics.action.generate')}
        </button>
        <button className="primary-button" type="button" onClick={downloadDiagnostic} disabled={!diagnostic || busy}>
          <DownloadIcon size={14} />
          {t('diagnostics.action.download')}
        </button>
      </div>

      {diagnostic && (
        <pre className="diagnostic-preview" aria-label={t('diagnostics.preview.aria')}>
          {serializeCompatibilityDiagnostic(diagnostic)}
        </pre>
      )}
      <p className="card-status" role="status">{status}</p>
    </section>
  );
}
