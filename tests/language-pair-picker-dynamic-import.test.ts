import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('LanguagePairPicker chunk separation (build-time)', () => {
  it('is loaded via React.lazy, not a static import, in entrypoints/options/App.tsx', () => {
    const path = resolve(
      process.cwd(),
      'entrypoints/options/App.tsx',
    );
    const source = readFileSync(path, 'utf8');
    // The static import statement is gone; the component is wrapped
    // in `lazy(() => import(...))` so the 270 kB ECharts payload is
    // only fetched when the language pair section first renders.
    expect(source).not.toMatch(/^import\s*\{\s*LanguagePairPicker\s*\}\s*from\s*['"]@\/src\/ui\/LanguagePairPicker['"]/m);
    expect(source).toMatch(/lazy\s*\(\s*async\s*\(\s*\)\s*=>\s*\{[^}]*await\s+import\s*\(\s*['"]@\/src\/ui\/LanguagePairPicker['"]/s);
  });

  it('is wrapped in <Suspense> at the call site so the initial Options paint does not block', () => {
    const path = resolve(process.cwd(), 'entrypoints/options/App.tsx');
    const source = readFileSync(path, 'utf8');
    // Find the <LanguagePairPicker .../> tag and confirm it sits
    // inside a <Suspense fallback={null}>.
    expect(source).toMatch(/<Suspense\s+[^>]*fallback=\{null\}[\s\S]*<LanguagePairPicker/);
    expect(source).toMatch(/<\/Suspense>\s*$/m);
  });
});
