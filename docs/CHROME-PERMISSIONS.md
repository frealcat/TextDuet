# Chrome Permissions

[中文](./CHROME-PERMISSIONS.zh-CN.md)

> Applies to the `0.2.0` production Manifest V3 build. Verify the generated
> `.output/chrome-mv3/manifest.json` before each release.

TextDuet uses the smallest permission set needed to translate a page after a
user action. It does not install a permanent content script or request access
to every website at installation time.

| Permission | Why it exists | When it is used |
| --- | --- | --- |
| `activeTab` | Temporarily inspect and operate on the tab the user chose. | The user starts a page translation or a selection translation. |
| `scripting` | Inject the locally bundled Translator Script on demand. | After a user action on a supported ordinary webpage. |
| `storage` | Keep non-secret settings, session state, encrypted Vault metadata, and local controls in extension storage. | When the user configures or uses TextDuet. |
| `contextMenus` | Add the “Translate selected text” command to Chrome's context menu. | The user right-clicks a text selection. |
| Optional `https://*/*` | Provide a requestable range for a configured HTTPS model API Origin. | Only after the user saves a Provider and Chrome presents the permission prompt. |

## Optional Provider Origin Access

`https://*/*` is an optional declaration, not install-time access to all HTTPS
websites. Before a Provider request, TextDuet normalizes the configured Base
URL to one HTTPS Origin (for example, `https://api.example.com/*`) and asks
Chrome for that Origin. A denial prevents the request; it does not cause
TextDuet to fall back to a broader permission.

The permission is for the model endpoint, not for reading arbitrary sites.
`activeTab` and the user action govern page access separately. If a user
changes Provider Origins, Chrome may show a new prompt. Users can revoke an
Origin in Chrome's extension settings.

When OpenRouter is selected, the public model-price request reuses the
authorized `https://openrouter.ai/*` Origin and calls `/api/v1/models` without
an API key, page text, model name, or usage history. DeepSeek balance requests
are sent only after a user click to the exact official Origin documented in
the [privacy policy](https://frealcat.github.io/TextDuet/privacy/).

## What Is Not Requested

The production manifest must not contain:

- static `content_scripts` that run on every site;
- static `host_permissions` or `<all_urls>`;
- install-time permission to read all browsing activity; or
- remote scripts, remotely hosted executable code, or a server-side proxy.

The Translator Script is bundled in the extension and injected only after the
user starts a supported operation. It cannot read Chrome storage or API keys.

## Supported Page Boundaries

TextDuet targets ordinary HTTP and HTTPS pages. Chrome internal pages such as
`chrome://` URLs, the Chrome Web Store, extension pages, protected browser
surfaces, login walls, CAPTCHAs, and paywalls are outside the supported
boundary. TextDuet does not bypass access controls or inject into pages where
Chrome refuses extension scripting.

Within a supported page, extraction excludes hidden content, scripts, styles,
code, forms, editable fields, buttons, and other interactive controls. Visible
reading links and navigation text can be eligible when they are meaningful
content. The [compatibility guide](./COMPATIBILITY.md) describes the intended
behavior and reporting route.

## Release Review

Run `npm run release:check`, then inspect the generated manifest:

```bash
sed -n '1,240p' .output/chrome-mv3/manifest.json
rg -n 'content_scripts|<all_urls>|permissions|host_permissions|optional_host_permissions' \
  .output/chrome-mv3/manifest.json
```

Any permission or data-scope change must first update the runtime contract,
architecture, privacy policy, this document, and the iteration record, and
must receive maintainer privacy review. A build is not ready merely because
the source configuration looks correct.
