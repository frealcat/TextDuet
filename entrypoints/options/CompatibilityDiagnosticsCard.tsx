import { Download, FileWarning, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import type { CompatibilityDiagnostic, RuntimeMessage } from '@/src/core/contracts';
import {
  parseCompatibilityDiagnostic,
  parseOperationResult,
} from '@/src/core/schemas';
import { serializeCompatibilityDiagnostic } from '@/src/core/compatibility-diagnostics';

const ISSUE_TYPES = [
  ['missed-content', '遗漏内容'],
  ['wrong-content', '译文不正确'],
  ['duplicate-translation', '重复翻译'],
  ['layout', '页面布局'],
  ['dynamic-content', '动态内容'],
  ['performance', '性能问题'],
  ['other', '其他'],
] as const;

export function CompatibilityDiagnosticsCard() {
  const [issueType, setIssueType] = useState<CompatibilityDiagnostic['issue']['type']>('other');
  const [includePath, setIncludePath] = useState(false);
  const [diagnostic, setDiagnostic] = useState<CompatibilityDiagnostic | null>(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  async function generateDiagnostic(): Promise<void> {
    setBusy(true);
    setStatus('正在读取当前页面的脱敏计数…');
    try {
      const rawResult: unknown = await browser.runtime.sendMessage({
        type: 'GET_COMPATIBILITY_DIAGNOSTIC',
        includePath,
      } satisfies RuntimeMessage);
      let nextDiagnostic: CompatibilityDiagnostic;
      try {
        nextDiagnostic = parseCompatibilityDiagnostic(rawResult);
      } catch {
        const operation = parseOperationResult(rawResult);
        throw new Error(operation.message || '无法生成诊断包');
      }
      setDiagnostic({
        ...nextDiagnostic,
        issue: { ...nextDiagnostic.issue, type: issueType },
      });
      setStatus('诊断包已在本机生成，请先检查预览');
    } catch (error) {
      setDiagnostic(null);
      setStatus(error instanceof Error ? error.message : '无法生成诊断包');
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
    setStatus(value ? '已同意包含当前页面路径，请重新生成预览' : '已移除路径包含选项，请重新生成预览');
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
    setStatus('诊断包已下载到本机');
  }

  return (
    <section className="settings-card diagnostics-card" aria-labelledby="diagnostics-heading">
      <div className="section-heading">
        <div>
          <span className="step">07</span>
          <h2 id="diagnostics-heading">兼容性诊断</h2>
        </div>
        <span className="badge">
          <FileWarning aria-hidden="true" size={12} strokeWidth={2} />
          默认仅本地
        </span>
      </div>

      <p className="cost-disclaimer">
        诊断包只包含主机名、可选路径和翻译计数，不包含正文、URL 参数、API Key、截图或自动上传。
        请先在目标网页启动一次翻译，再回到这里为最近翻译的页面生成。
      </p>

      <div className="diagnostic-controls">
        <label className="select-field">
          <span>问题类型</span>
          <select
            value={issueType}
            onChange={(event) => updateIssueType(event.target.value as CompatibilityDiagnostic['issue']['type'])}
          >
            {ISSUE_TYPES.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
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
            <strong>包含当前页面路径</strong>
            <small>路径可能识别具体文章；默认不包含。</small>
          </span>
        </label>
      </div>

      <p className="diagnostic-screenshot-note">截图诊断暂未启用，不会采集或写入任何截图。</p>

      <div className="card-actions">
        <button className="secondary-button" type="button" onClick={generateDiagnostic} disabled={busy}>
          <RefreshCw className={busy ? 'spin' : ''} aria-hidden="true" size={14} strokeWidth={2} />
          {busy ? '生成中…' : '生成本地预览'}
        </button>
        <button className="primary-button" type="button" onClick={downloadDiagnostic} disabled={!diagnostic || busy}>
          <Download aria-hidden="true" size={14} strokeWidth={2} />
          下载诊断包
        </button>
      </div>

      {diagnostic && (
        <pre className="diagnostic-preview" aria-label="兼容性诊断包预览">
          {serializeCompatibilityDiagnostic(diagnostic)}
        </pre>
      )}
      <p className="card-status" role="status">{status}</p>
    </section>
  );
}
