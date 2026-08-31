# TextDuet 0.2.0 Release Notes

[中文](./RELEASE-NOTES-0.2.0.zh-CN.md)

> **Draft / unpublished.** These notes describe the planned first public
> `0.2.0` release. They are not evidence that the Chrome Web Store listing or
> GitHub Release is live. Do not add a release date, Store URL, extension ID,
> checksum, or publication claim until the maintainer records the final
> artifacts.

## Release Scope

TextDuet `0.2.0` combines the verified local translation workflow with the
security, privacy, documentation, and distribution preparation required for a
first public release. The Chrome Web Store is the recommended installation
channel; a GitHub Release ZIP and source build remain available for advanced
users and contributors.

The final release must be built and checked from the exact reviewed commit and
package. This document is intentionally a draft until those gates are complete.

## Highlights

- Translate user-selected visible reading text in the current tab, with
  bilingual, source-only, and translation-only display modes.
- Use OpenAI-compatible HTTPS providers, including OpenAI, Qwen, DeepSeek,
  OpenRouter, SiliconFlow, and custom endpoints.
- Translate selected text from Chrome's context menu and optionally process
  dynamic content while a page run is active.
- Reuse bounded local translations, inspect the local token ledger, and set
  optional budget reminders.
- Use a session-only API key or a password-unlocked local Vault for encrypted
  persistence. The Vault password is never stored.
- Keep provider requests, secret handling, and storage access in trusted
  extension contexts. Translator code cannot read Chrome extension storage.
- Render provider output as validated plain text, never as HTML or executable
  code.
- Provide English and Simplified Chinese documentation, installation paths,
  privacy materials, contribution rules, and community reporting guidance.

## Security And Privacy

Translation starts only after the user chooses to start it. Eligible page text
is sent directly from Chrome to the Provider selected by the user; TextDuet has
no translation proxy, account backend, telemetry, advertising, cloud sync, or
automatic issue upload. The selected Provider may retain data, charge for
requests, or apply its own training and privacy practices.

`0.2.0` defines two key-storage modes:

- **Session only:** the key is available for the browser session and is cleared
  when Chrome restarts.
- **Local Vault:** local-mode keys and persistent translation cache are stored
  in a versioned AES-GCM encrypted envelope. Unlock material stays in the
  browser session; restarting Chrome locks the Vault and requires the user to
  unlock it again.

The password is never persisted. Locking or clearing the Vault removes access
to persistent secrets and cache; current-page in-memory reuse can continue only
within the active page session. Legacy plaintext keys and origin maps must be
migrated or removed before the final package is published.

Before the first Provider request, the extension must show the versioned
privacy acknowledgement describing direct page-text transmission, possible
Provider charges, and the Provider's responsibility for data handling. See the
[privacy policy](./PRIVACY.md) and [Chrome permissions guide](./CHROME-PERMISSIONS.md)
for the public data-flow and permission boundaries.

## Translation And Regression Coverage

The release target includes the active/inactive visibility regression fix:
returning to a visible tab performs an idempotent reconciliation and must not
insert a second TextDuet translation region. Real repeated navigation or
reading items remain separate candidates; translation-memory reuse never
replaces node ownership.

The candidate boundary continues to exclude TextDuet-owned nodes, buttons,
form controls, editable fields, code, hidden content, and other interactive
controls. Dynamic pages, SPA navigation, virtualized nodes, repeated text in
separate containers, and stop/cancel/error paths require browser verification
before publication.

## Installation Channels

| Channel | Intended audience | Updates |
| --- | --- | --- |
| Chrome Web Store | Most users; recommended | Chrome-managed automatic updates |
| GitHub Release ZIP | Advanced users and testers | Manual download and reload |
| Source build | Contributors and developers | `npm ci` followed by a local build |

Store, manually loaded, and source-built extensions can have different IDs and
separate Chrome storage. Users must not assume that API keys, Vault records,
cache, or usage history migrate between channels. A ZIP must be unpacked before
it can be loaded through `chrome://extensions`.

## Compatibility And Known Boundaries

- Target platform is Google Chrome with Manifest V3. Edge, Firefox, Safari,
  Chrome internal pages, the Chrome Web Store, login walls, paywalls,
  CAPTCHAs, and other protected pages are outside the supported boundary.
- Dynamic and SPA pages are supported on a best-effort basis; websites can
  change their DOM at any time.
- Buttons, forms, editable fields, code, hidden content, and TextDuet's own
  DOM are intentionally not translated.
- The user pays any Provider request charges and must review the Provider's
  pricing, limits, retention, and data practices.
- Only `en` and `zh-CN` are included in the public UI and documentation for
  this release.

## Verification Status

The following remain maintainer gates, not claims of completion in this draft:

- Clean-profile Options, Popup, Vault, migration, cache, uninstall, and
  active/inactive browser regression checks.
- `npm ci`, typecheck, unit tests, build, release verification, dependency and
  license checks, secret scans, SBOM generation, and exact ZIP checksum.
- Chrome Web Store User Data Policy, Limited Use, permission, privacy URL, and
  no-remote-code declarations.
- GitHub Pages, Discussions, Private Vulnerability Reporting, branch
  protection, Dependabot, CodeQL, labels, and welcome text configuration.

When these gates pass, the maintainer may add the final date, tag, artifact
hashes, Store status, and GitHub Release link to this file and the changelog.

## Related Documents

- [Installation](./INSTALLATION.md)
- [Development](./DEVELOPMENT.md)
- [Privacy policy](./PRIVACY.md)
- [Changelog](../CHANGELOG.md)
