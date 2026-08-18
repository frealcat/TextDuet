import { TRANSLATION_BLOCK_SELECTOR } from './dom-extraction';
import { SOURCE_CLASS, TRANSLATION_CLASS } from './page-status';

export const DYNAMIC_CONTENT_SCAN_DELAY_MS = 250;

/** Observes only the active page session and suppresses mutations created by TextDuet itself. */
export function observeDynamicContent(
  sourceTextByElement: WeakMap<HTMLElement, string>,
  onContentChanged: () => void,
): MutationObserver {
  const observer = new MutationObserver((records) => {
    const relevantRecords = records.filter((record) => !isTextDuetMutation(record));
    if (relevantRecords.length === 0) return;
    for (const record of relevantRecords) invalidateChangedCandidate(record, sourceTextByElement);
    onContentChanged();
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['aria-hidden', 'class', 'hidden', 'style'],
    childList: true,
    characterData: true,
    subtree: true,
  });
  return observer;
}

function isTextDuetMutation(record: MutationRecord): boolean {
  const target = record.target instanceof Element ? record.target : record.target.parentElement;
  if (target?.closest(`#textduet-status, .${TRANSLATION_CLASS}, .${SOURCE_CLASS}, #textduet-styles`)) return true;
  if (record.type !== 'childList') return false;
  return record.addedNodes.length > 0
    && [...record.addedNodes].every(isTextDuetNode);
}

function isTextDuetNode(node: Node): boolean {
  if (!(node instanceof Element)) return false;
  return node.matches(`#textduet-status, .${TRANSLATION_CLASS}, .${SOURCE_CLASS}, #textduet-styles`)
    || Boolean(node.closest(`#textduet-status, .${TRANSLATION_CLASS}, .${SOURCE_CLASS}, #textduet-styles`));
}

function invalidateChangedCandidate(
  record: MutationRecord,
  sourceTextByElement: WeakMap<HTMLElement, string>,
): void {
  if (record.type === 'attributes') return;
  const target = record.target instanceof HTMLElement
    ? record.target
    : record.target.parentElement;
  const candidate = target?.closest<HTMLElement>(TRANSLATION_BLOCK_SELECTOR);
  if (candidate) clearCandidate(candidate, sourceTextByElement);

  if (record.type !== 'childList') return;
  for (const addedNode of record.addedNodes) {
    if (!(addedNode instanceof HTMLElement)) continue;
    if (addedNode.matches(TRANSLATION_BLOCK_SELECTOR)) {
      clearCandidate(addedNode, sourceTextByElement);
    }
    for (const addedCandidate of addedNode.querySelectorAll<HTMLElement>(
      TRANSLATION_BLOCK_SELECTOR,
    )) {
      clearCandidate(addedCandidate, sourceTextByElement);
    }
  }
}

function clearCandidate(
  candidate: HTMLElement,
  sourceTextByElement: WeakMap<HTMLElement, string>,
): void {
  candidate.querySelector<HTMLElement>(`:scope > .${TRANSLATION_CLASS}`)?.remove();
  sourceTextByElement.delete(candidate);
}
