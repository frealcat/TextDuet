# TextDuet Privacy Policy

[中文](./PRIVACY.zh-CN.md)

> Last updated: 2026-08-28
>
> Applies to the TextDuet `0.2.0` release candidate and the matching Chrome
> Web Store, GitHub Release, and source-built packages when they are published.

TextDuet is a local-first Chrome extension for reading webpages in two
languages. It uses a provider that you choose and an API key that you provide.
TextDuet does not operate a translation proxy, account service, telemetry
service, cloud sync, or automatic issue-upload service.

## Short Version

When you explicitly start a translation, eligible visible webpage text is sent
directly from Chrome to the model provider configured in TextDuet. No
TextDuet-operated server or project operator receives or relays that text.
Your provider may retain the request,
charge for it, or process it under its own terms. Review those terms before
translating confidential, personal, or regulated material.

## Data TextDuet Processes

### Webpage content

After a user action, the Translator Script identifies visible, eligible
reading text in the current HTTP or HTTPS page. The request can include the
source text, source and target languages, and the translation instructions.
For readability decisions, a request can also contain normalized source text
color, effective background color, and the user's local color preference.
These values are sent directly to the selected provider along with the model
request. They are not sent to a TextDuet server.

While a translation is running, newly loaded eligible content can be sent in a
later batch until the user stops the run, navigates away, or the page session
ends. Forms, editable fields, hidden content, code, and TextDuet's own nodes
are excluded by the page extraction rules.

### Provider configuration and API keys

Provider origin, model names, language preferences, display settings, prices,
and budget preferences are stored in the extension's local storage. A saved
raw API key is read only by the Service Worker. A trusted extension page can
hold a key the user is actively entering long enough to send it in a validated
message, but it is never given a saved key. A key is never returned in public
settings, sent to the webpage, or passed to the Translator Script.

TextDuet supports two key lifecycles:

- **Session-only:** the key is held in restricted `storage.session` and is
  cleared when the browser session ends.
- **Local Vault:** when the user explicitly chooses persistence, the key is
  stored inside a versioned AES-GCM encrypted Vault. The password is never
  stored. Only derived unlock material is kept in restricted session storage
  for the current browser session; after a browser restart the Vault is locked
  and must be unlocked again.

The Vault can be locked, deleted, or cleared from Options. Older plaintext key
slots and per-origin key maps are migrated once when they can be encrypted;
data that cannot be safely migrated is removed and the user is asked to enter
the key again. Browser extension storage is not an operating-system password
manager, even when the Vault is enabled.

### Local translation cache

The optional persistent translation cache is managed by the Service Worker. In
the `0.2.0` release line it is encrypted with the same local Vault and is
available only while the Vault is unlocked. The cache uses content-addressed
records containing a digest, translated text, language/provider/model context,
and timestamps; it does not store an API key or URL. It is limited to 30 days
and 50 MiB, with expiry and least-recently-used cleanup. Users can clear the
cache from Options.

When the Vault is locked, persistent cache lookups and writes are disabled. A
current page may still reuse translations held only in that page's memory for
the current run. A cache hit avoids a provider request and does not add a new
usage-ledger entry.

### Usage ledger and diagnostics

The local usage ledger records the local date, provider, model, provider-
returned input/output token counts, currency, and fields needed for a local
budget reminder. It is retained for the documented rolling history (currently
60 local days) and does not contain page text, URLs, API keys, or request
bodies. Amounts shown for budgets are local estimates, not a provider invoice.

Options can generate a compatibility diagnostic preview locally. By default it
contains only a redacted hostname, extension/Chrome versions, standardized
status codes, and counts. A page path is excluded unless the user checks a
separate consent control; query parameters and fragments are removed. The
diagnostic is previewed and downloaded by the user and is not uploaded
automatically. It must be reviewed before being attached to a public report.

## Data TextDuet Does Not Collect

TextDuet currently has no:

- account registration, advertising, analytics SDK, telemetry, or cloud sync;
- project-operated translation backend or automatic browsing-history upload;
- automatic issue, screenshot, diagnostic, or page-content upload; or
- project access to a user's API key, provider account, webpage history, form
  values, or translated pages after the direct provider request.

Chrome and the selected provider may process data under their own policies.
Uninstalling TextDuet asks Chrome to remove extension storage according to
Chrome's behavior; data already received by a provider is governed by that
provider.

## Third-Party Provider Processing

The selected provider receives the text and request metadata needed to produce
the translation. TextDuet cannot control the provider's retention, training,
geographic processing, availability, or billing practices.

Some user-triggered supporting requests are provider-specific:

- **OpenRouter model pricing:** TextDuet may request the public
  `https://openrouter.ai/api/v1/models` catalog through the Service Worker.
  This request does not include the user's API key, model name, page text, or
  local usage history; matching is performed locally.
- **DeepSeek balance:** when the user has configured the exact official
  DeepSeek origin and clicks the balance action, the saved DeepSeek API key is
  sent to the official `/user/balance` endpoint. The returned recharge and
  gift balances are shown only in the current Options page and are not stored
  or converted into token usage. Custom endpoints cannot use this action.

These provider calls are not a TextDuet account or billing service. Users are
responsible for provider terms, credentials, rate limits, and charges.

## User Controls

Users decide when to start and stop a translation, which provider and model to
use, and whether to grant the configured HTTPS origin permission. Options
provides controls to:

- keep a key for the current session or use the password-unlocked Vault;
- lock, delete, or clear the Vault and its encrypted persistent records;
- clear the persistent translation cache and the local usage ledger; and
- revoke the provider origin permission through Chrome's extension settings.

Changing display mode, locking the Vault, or clearing local data does not ask a
provider to delete data it has already received. Contact that provider for
provider-side deletion or billing questions.

## Security Boundaries

The Service Worker is the only business context that reads secrets and builds
provider requests. Translator code receives only validated block IDs, source
text, language settings, and validated translations; it does not access
Chrome storage. Runtime messages and model responses are schema-checked, and
translated content is inserted as plain text rather than HTML or executable
code.

No software can guarantee absolute security. Do not publish a key, password,
authorization header, private URL, private page text, or sensitive screenshot
in an issue or discussion. Report suspected vulnerabilities privately through
[GitHub Private Vulnerability Reporting](https://github.com/frealcat/TextDuet/security/advisories/new)
or [frealcat@gmail.com](mailto:frealcat@gmail.com).

## Chrome Web Store Disclosure

Webpage content, browsing activity involved in a user-triggered translation,
and authentication information are user-data categories that must be
described accurately in the Chrome Web Store listing, even when processing is
local or sent directly to a user-selected provider. The listing and this
policy are reviewed together before publication.

Canonical public policy pages:

- English: <https://frealcat.github.io/TextDuet/privacy/>
- Simplified Chinese: <https://frealcat.github.io/TextDuet/zh-CN/privacy/>

Material changes to data handling will update this policy and the store
disclosure before the affected build is published. The project contact for
privacy and security questions is [frealcat@gmail.com](mailto:frealcat@gmail.com).
