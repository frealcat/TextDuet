export const TRANSLATION_CLASS = 'textduet-translation';
export const SOURCE_CLASS = 'textduet-source';
/** In-page nodes owned by the optional selected-text action. */
export const SELECTION_TRANSLATION_CLASS = 'textduet-selection-translation';
export const SELECTION_ERROR_CLASS = 'textduet-selection-error';
export const SELECTION_QUICK_ACTION_CLASS = 'textduet-selection-quick-action';
/** Stable per-element id written by the renderer for later reconciliation. */
export const SOURCE_BLOCK_ID_ATTRIBUTE = 'data-td-block-id';

let lastKnownPageStatusState: PageStatusState | 'idle' = 'idle';
let lastStatusMessage = '';

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
      color: var(--textduet-translation-color, #9c5e2e) !important;
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
    .${SELECTION_QUICK_ACTION_CLASS} {
      all: initial !important;
      position: fixed !important;
      z-index: 2147483646 !important;
      width: 30px !important;
      height: 30px !important;
      min-width: 30px !important;
      padding: 0 !important;
      border: 1px solid rgb(255 255 255 / 70%) !important;
      border-radius: 8px !important;
      color: #fff !important;
      background: #9c5e2e !important;
      box-shadow: 0 4px 12px rgb(0 0 0 / 24%) !important;
      font: 700 12px/1 system-ui, sans-serif !important;
      letter-spacing: 0 !important;
      text-align: center !important;
      text-shadow: 0 1px 1px rgb(0 0 0 / 22%) !important;
      display: grid !important;
      place-items: center !important;
      user-select: none !important;
      cursor: pointer !important;
    }
    .${SELECTION_QUICK_ACTION_CLASS}:hover { background: #7d4b24 !important; }
    .${SELECTION_TRANSLATION_CLASS} {
      display: block !important;
      margin-top: 0.35em !important;
      font: inherit !important;
      line-height: inherit !important;
    }
  `;
  (document.head || document.documentElement).append(style);
}

export function updatePageStatus(message: string, state: PageStatusState): void {
  lastKnownPageStatusState = state;
  lastStatusMessage = message.slice(0, 2_000);
}

export function setTranslationDisplayMode(mode: 'bilingual' | 'source-only' | 'translated-only'): void {
  document.documentElement.dataset.textduetDisplayMode = mode;
}

export function setTranslationColor(color: string): void {
  document.documentElement.style.setProperty('--textduet-translation-color', color);
}

export function getPageTranslationState(): { state: PageStatusState | 'idle'; hasRun: boolean; message: string } {
  return { state: lastKnownPageStatusState, hasRun: lastKnownPageStatusState !== 'idle', message: lastStatusMessage };
}
