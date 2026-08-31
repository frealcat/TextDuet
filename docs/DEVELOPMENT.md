# Development Guide

[中文](./DEVELOPMENT.zh-CN.md)

TextDuet is a Chrome-only Manifest V3 extension built with WXT, React,
TypeScript strict, Vitest, and npm. The Service Worker owns provider requests
and secrets; the on-demand Translator Script processes page DOM and never
reads extension storage.

## Requirements

- Node.js 22 LTS or later (use the version selected by the repository's CI or
  `.nvmrc` when one is present).
- npm with the checked-in `package-lock.json`.
- A current stable Google Chrome release for manual loading.

## Install, Check, And Build

```bash
npm ci
npm run typecheck
npm test
npm run build
```

Load the generated extension from `.output/chrome-mv3`:

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked** and select `.output/chrome-mv3`.
4. After source changes, run `npm run build` and reload the extension.

For the complete public-repository release gate, including ZIP creation and
the artifact checks, run:

```bash
npm run release:check
```

The ZIP is written under `.output/` as
`textduet-<package-version>-chrome.zip`. Chrome must load the unpacked folder,
not the ZIP itself. Generated output is not a source of truth and must not be
committed.

## Development Server

Use `npm run dev` when iterating on the WXT development build. The development
server is not the same artifact as the release ZIP; verify release behavior
with `npm run build` and the generated `.output/chrome-mv3` directory.

## Public Privacy Pages

The public privacy pages are generated from the reviewed English and Simplified
Chinese policy sources. Build them locally with:

```bash
npm run pages:build
```

This creates the disposable `.pages/` directory with the English policy at
`privacy/index.html`, the Simplified Chinese policy at
`zh-CN/privacy/index.html`, and a small language-selection home page. Review
the generated pages before merge when a policy, page template, or stylesheet
changes. The command neither deploys Pages nor makes a public URL live.

The repository workflow deploys only after the reviewed source reaches `main`
and a maintainer enables **GitHub Actions** as the Pages source. Before using
the canonical URLs publicly, confirm both deployed pages return `200` without a
signed-in GitHub session and show the current policy date.

## Browser Regression Commands

The repository includes deterministic Playwright scripts for options UI,
synthetic corpus, billing, and public-site compatibility:

```bash
npm run test:browser:options
npm run test:browser:corpus
npm run test:browser:billing
npm run test:browser:sites
```

CI and release jobs also run a local fixture smoke test. To run the same gate
locally, install the pinned browser and start the fixture server in a separate
terminal:

```bash
npx playwright install chromium
node scripts/serve-fixtures.mjs
```

Then run the smoke harness with the built extension and the Playwright Chrome
(the harness fixes its UI locale to Simplified Chinese for deterministic
labels):

```bash
PLAYWRIGHT_ENTRY="$(node --input-type=module -e 'process.stdout.write(await import.meta.resolve("playwright"))')" \
CHROME_EXECUTABLE="$(node --input-type=module -e 'const playwrightModule = await import("playwright"); const { chromium } = playwrightModule.default ?? playwrightModule; process.stdout.write(chromium.executablePath())')" \
EXTENSION_DIR="$PWD/.output/chrome-mv3" \
FIXTURE_URL=http://127.0.0.1:8765/multilingual.html \
npm run test:browser:smoke
```

The fixture server serves only the original files under
`tests/fixtures/pages/`, rejects traversal and non-file paths, and must not be
used to host arbitrary user content. If port `8765` is occupied, start it with
`TEXTDUET_FIXTURE_PORT=8876 node scripts/serve-fixtures.mjs` and use the same
port in `FIXTURE_URL`. The smoke test uses a mock Provider and the test-only API
key literal from the harness.

These scripts require a local Playwright/Chrome setup and the environment
variables documented in the script or test harness. They use synthetic pages,
mock providers, or local cache fixtures by default; they must not read a real
key or make an unreviewed paid request. Public-site runs may fail because a
site or network blocks automated access. Record that as an environment result,
not as a product pass or failure.

## Real Provider Checks

Only a user-controlled local manual check may use a real Provider. Put values
in the ignored `.env.local` file, using the names shown in `.env.example`:

```dotenv
TEXTDUET_TEST_API_HOST=api.example.com
TEXTDUET_TEST_API_BASE_URL=https://api.example.com/v1
TEXTDUET_TEST_API_KEY=
TEXTDUET_TEST_MODEL=
```

Never commit `.env.local`, paste a key into an issue/PR, include it in a test
fixture or screenshot, or expose it through a `VITE_`/`WXT_PUBLIC_` variable.
Normal unit and browser tests use mocks and should not incur model-provider
charges. Real requests can cost money and may transmit page text to the
selected Provider; start with a short public page and stop the run when done.

## Security And Architecture Rules

- Keep API keys in trusted extension contexts only. Public settings and runtime
  messages must remain redacted.
- Do not import storage or Provider modules into the Translator Script.
- Keep the optional HTTPS Origin request scoped to the configured Provider.
- Render model output as text; do not use `innerHTML`, `eval`, or remote code.
- Add tests for malformed provider responses, duplicate/injected DOM content,
  stop and cancellation paths, and Vault lock/migration behavior when those
  areas change.
- Keep the Pages generator free of analytics, remote scripts, remote fonts,
  and private or user-specific content.
- Do not add telemetry, a proxy server, account collection, or a new Manifest
  permission without a documented product and privacy decision.

See [CONTRIBUTING.md](../CONTRIBUTING.md) and
[ARCHITECTURE.md](./ARCHITECTURE.md) for public contribution and engineering
guidance.

## Release Preparation

Before a release, run `npm run release:check`, perform clean-profile QA, and
review the generated ZIP, SBOM, third-party license report, and SHA-256 file.
Publishing, tagging, uploading, and Chrome dashboard changes remain maintainer
actions; this guide does not authorize them.
