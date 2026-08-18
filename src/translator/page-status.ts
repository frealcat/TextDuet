export const TRANSLATION_CLASS = 'textduet-translation';
export const SOURCE_CLASS = 'textduet-source';

const STATUS_ID = 'textduet-status';
const STATUS_HIDE_DELAY_MS = 3_500;
let statusHideTimer: number | undefined;
let lastKnownPageStatusState: PageStatusState | 'idle' = 'idle';

export type PageStatusState = 'progress' | 'complete' | 'stopped' | 'empty' | 'error';

export function injectPageStyles(): void {
  if (document.getElementById('textduet-styles')) {
    return;
  }

  const style = document.createElement('style');
  style.id = 'textduet-styles';
  style.textContent = `
    .${TRANSLATION_CLASS} {
      display: block !important;
      margin-top: 0.35em !important;
      color: var(--textduet-translation-color, #147d64) !important;
      font: inherit !important;
      line-height: inherit !important;
    }
    .${SOURCE_CLASS} {
      display: contents !important;
    }
    html[data-textduet-display-mode="translated-only"] .${SOURCE_CLASS} {
      display: none !important;
    }
    html[data-textduet-display-mode="source-only"] .${TRANSLATION_CLASS} {
      display: none !important;
    }
    #${STATUS_ID} {
      position: fixed !important;
      right: 18px !important;
      bottom: 18px !important;
      z-index: 2147483647 !important;
      max-width: min(390px, calc(100vw - 36px)) !important;
      padding: 10px 13px !important;
      border: 1px solid rgb(20 125 100 / 28%) !important;
      border-radius: 10px !important;
      color: #17211e !important;
      background: #f7faf8 !important;
      box-shadow: 0 8px 28px rgb(23 33 30 / 16%) !important;
      font: 13px/1.45 ui-sans-serif, system-ui, sans-serif !important;
    }
    #${STATUS_ID}[data-textduet-state="error"] {
      border-color: #b54b4b !important;
      color: #7e2929 !important;
      background: #fff8f7 !important;
    }
  `;
  (document.head || document.documentElement).append(style);
}

export function updatePageStatus(message: string, state: PageStatusState): void {
  lastKnownPageStatusState = state;
  if (statusHideTimer !== undefined) {
    window.clearTimeout(statusHideTimer);
    statusHideTimer = undefined;
  }
  let status = document.getElementById(STATUS_ID);
  if (!status) {
    status = document.createElement('aside');
    status.id = STATUS_ID;
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    (document.body || document.documentElement).append(status);
  }

  status.dataset.textduetState = state;
  status.textContent = `TextDuet · ${message}`;
  if (state === 'complete' || state === 'stopped') {
    const currentStatus = status;
    statusHideTimer = window.setTimeout(() => {
      currentStatus.remove();
      statusHideTimer = undefined;
    }, STATUS_HIDE_DELAY_MS);
  }
}

export function setTranslationDisplayMode(mode: 'bilingual' | 'source-only' | 'translated-only'): void {
  document.documentElement.dataset.textduetDisplayMode = mode;
}

export function setTranslationColor(color: string): void {
  document.documentElement.style.setProperty('--textduet-translation-color', color);
}

export function getPageTranslationState(): { state: PageStatusState | 'idle'; hasRun: boolean } {
  return { state: lastKnownPageStatusState, hasRun: lastKnownPageStatusState !== 'idle' };
}
