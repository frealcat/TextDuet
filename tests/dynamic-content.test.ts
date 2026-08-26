import { describe, expect, it } from 'vitest';
import { parseHTML } from 'linkedom';
import { clearCandidate } from '@/src/translator/dynamic-content';
import { SOURCE_CLASS, TRANSLATION_CLASS } from '@/src/translator/page-status';

const { document: linkedomDocument } = parseHTML('<!doctype html><html></html>');

function makeFragment(html: string): { root: HTMLElement; document: Document } {
  const doc = parseHTML('<main>' + html + '</main>').document as unknown as Document;
  return { root: doc.querySelector('main') as unknown as HTMLElement, document: doc };
}

describe('dynamic-content translation loop break', () => {
  it('keeps the translation when the candidate text has not changed (loop break)', () => {
    const { root: candidate, document: doc } = makeFragment('<h3 id="c1">Weekly update</h3>');
    const sourceText = new WeakMap<HTMLElement, string>();
    // Simulate the realistic state: the source wrapper already exists
    // and the original text is cached. The translation is appended.
    const sourceWrapper = doc.createElement('span');
    sourceWrapper.className = SOURCE_CLASS;
    sourceWrapper.innerHTML = 'Weekly update';
    candidate.append(sourceWrapper);
    sourceText.set(candidate, 'Weekly update');
    const translation = doc.createElement('span');
    translation.className = TRANSLATION_CLASS;
    translation.textContent = '本周更新';
    candidate.append(translation);

    const result = clearCandidate(candidate, sourceText);
    expect(result).toBe(false);
    expect(candidate.querySelector(`.${TRANSLATION_CLASS}`)).toBe(translation);
  });

  it('removes the translation when the candidate text has changed', () => {
    const { root: candidate, document: doc } = makeFragment('<h3 id="c2">Loading...</h3>');
    const sourceText = new WeakMap<HTMLElement, string>();
    const sourceWrapper = doc.createElement('span');
    sourceWrapper.className = SOURCE_CLASS;
    sourceWrapper.innerHTML = 'Loading...';
    candidate.append(sourceWrapper);
    sourceText.set(candidate, 'Loading...');
    const translation = doc.createElement('span');
    translation.className = TRANSLATION_CLASS;
    translation.textContent = '加载中…';
    candidate.append(translation);

    // Simulate hydration: source text changes
    sourceWrapper.innerHTML = 'Weekly update';

    const result = clearCandidate(candidate, sourceText);
    expect(result).toBe(true);
    expect(candidate.querySelector(`.${TRANSLATION_CLASS}`)).toBe(null);
    expect(sourceText.get(candidate)).toBe('Weekly update');
  });

  it('removes the translation on first clear, then no-ops for unchanged text', () => {
    const { root: candidate, document: doc } = makeFragment('<p id="c3">Hello world</p>');
    const sourceText = new WeakMap<HTMLElement, string>();
    const sourceWrapper = doc.createElement('span');
    sourceWrapper.className = SOURCE_CLASS;
    sourceWrapper.innerHTML = 'Hello world';
    candidate.append(sourceWrapper);
    const translation = doc.createElement('span');
    translation.className = TRANSLATION_CLASS;
    candidate.append(translation);

    const result = clearCandidate(candidate, sourceText);
    expect(result).toBe(true);
    expect(candidate.querySelector(`.${TRANSLATION_CLASS}`)).toBe(null);
    expect(sourceText.get(candidate)).toBe('Hello world');

    const result2 = clearCandidate(candidate, sourceText);
    expect(result2).toBe(false);
  });
});

import {
  scheduleBackgroundTask,
  yieldToMain,
  isBackgroundTaskSchedulerAvailable,
} from '@/src/translator/scheduler-helper';

describe('scheduler-helper (Layer 4)', () => {
  it('runs the callback when no signal is provided', async () => {
    let called = false;
    await scheduleBackgroundTask(() => {
      called = true;
    });
    expect(called).toBe(true);
  });

  it('skips execution when the signal is already aborted', async () => {
    let called = false;
    const ac = new AbortController();
    ac.abort();
    await scheduleBackgroundTask(
      () => {
        called = true;
      },
      { signal: ac.signal },
    );
    expect(called).toBe(false);
  });

  it('awaits an async callback before resolving', async () => {
    const events: string[] = [];
    await scheduleBackgroundTask(async () => {
      events.push('start');
      await Promise.resolve();
      events.push('end');
    });
    expect(events).toEqual(['start', 'end']);
  });

  it('yieldToMain resolves without throwing in node', async () => {
    await expect(yieldToMain()).resolves.toBeUndefined();
  });

  it('isBackgroundTaskSchedulerAvailable returns a boolean (no throw in node env)', () => {
    expect(typeof isBackgroundTaskSchedulerAvailable()).toBe('boolean');
  });
});
