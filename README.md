# TextDuet

> Your key. Two languages. One page.

[中文](./README.zh-CN.md) | [License](./LICENSE) | [Privacy](https://frealcat.github.io/TextDuet/privacy/) | [Support](./SUPPORT.md) | [Security](./SECURITY.md)

TextDuet is a local-first, open-source Chrome extension for reading webpages in two languages. You choose an OpenAI-compatible model provider, supply your own API key, and start a translation from the extension. Page text goes directly from Chrome to the provider you selected; TextDuet does not operate a translation proxy or an account service.

**Release status:** TextDuet `0.2.0` is being prepared for its first public release. Chrome Web Store availability and the matching GitHub Release link will be added when the review and release gates are complete. Do not treat a source checkout or an unpublished build as a final release.

## What It Does

- Translates user-selected, visible reading text in the current tab and renders bilingual, source-only, or translation-only reading modes.
- Supports OpenAI-compatible APIs and provider presets for OpenAI, Qwen, DeepSeek, OpenRouter, SiliconFlow, and custom HTTPS endpoints.
- Keeps model configuration and usage data local to the extension. API keys are handled only in trusted extension contexts and never inserted into the webpage.
- Uses opt-in runtime access to the configured HTTPS provider origin. It does not register a permanent content script or install-wide website permission.
- Provides translation cache controls, local token usage history, budget reminders, selection translation, and an export-only compatibility diagnostic.

TextDuet has no extension subscription fee. Your model provider may charge for API requests. Review the provider's terms, pricing, and data practices before translating sensitive material.

## Install And Update

| Channel | Intended for | Installation and updates | Support boundary |
| --- | --- | --- | --- |
| Chrome Web Store | Most users | Store installation and automatic updates | Recommended, supported distribution |
| [GitHub Releases](https://github.com/frealcat/TextDuet/releases) | Advanced users and testers | Download the versioned ZIP, unpack it, then load the unpacked folder in `chrome://extensions`; updates are manual | Supported best effort; ZIP files cannot be loaded directly |
| Source build | Contributors and developers | Build from a checked-out source tree and load `.output/chrome-mv3` | Development and troubleshooting workflow |

The Store and manually loaded builds can have different extension IDs and separate Chrome storage. Do not assume that API keys, local caches, or usage records migrate between them.

Detailed installation and update instructions: [English](./docs/INSTALLATION.md) | [中文](./docs/INSTALLATION.zh-CN.md)

### Build From Source

Requirements: Node.js 22 LTS or later, npm, and a current stable Chrome release.

```bash
npm ci
npm run typecheck
npm test
npm run build
```

Open `chrome://extensions`, enable **Developer mode**, select **Load unpacked**, and choose `.output/chrome-mv3`. Rebuild and click Chrome's reload button after code changes.

For a release-candidate package and its local checks:

```bash
npm run release:check
```

The command creates `.output/textduet-<version>-chrome.zip`. Unpack the ZIP before loading it into Chrome. See [development documentation](./docs/DEVELOPMENT.md) for test commands, browser requirements, and local-provider safeguards.

## Privacy And Security

- Translation is user initiated. Text from eligible visible reading areas is sent directly to the model provider you configure; it does not pass through a TextDuet server.
- TextDuet has no account system, telemetry, ads, cloud sync, or automatic issue upload.
- API keys, passwords, request headers, and page text are never written to issue templates, diagnostics, or repository examples.
- `0.2.0` supports session-only keys and a password-unlocked local **Vault**. Session keys clear when Chrome restarts. Local-mode keys and the persistent translation cache are encrypted at rest with AES-GCM; the password is never stored, and a restart leaves the Vault locked until the user unlocks it. While locked, persistent cache is unavailable, though a current page may reuse its in-memory translations.
- Model output is treated as untrusted text and is rendered as text, not HTML or executable code.

Read the full policy before installing: [Privacy Policy](https://frealcat.github.io/TextDuet/privacy/) | [隐私政策](https://frealcat.github.io/TextDuet/zh-CN/privacy/) | [Chrome permissions](./docs/CHROME-PERMISSIONS.md).

To report a vulnerability, do **not** open a public issue. Use [GitHub private vulnerability reporting](https://github.com/frealcat/TextDuet/security/advisories/new) or email [frealcat@gmail.com](mailto:frealcat@gmail.com). See [SECURITY.md](./SECURITY.md).

## Documentation

| Topic | English | 中文 |
| --- | --- | --- |
| Installation and updates | [Installation](./docs/INSTALLATION.md) | [安装与更新](./docs/INSTALLATION.zh-CN.md) |
| Development and local build | [Development](./docs/DEVELOPMENT.md) | [开发](./docs/DEVELOPMENT.zh-CN.md) |
| Privacy policy | [Privacy](https://frealcat.github.io/TextDuet/privacy/) | [隐私](https://frealcat.github.io/TextDuet/zh-CN/privacy/) |
| Permissions | [Chrome permissions](./docs/CHROME-PERMISSIONS.md) | [Chrome 权限](./docs/CHROME-PERMISSIONS.zh-CN.md) |
| Compatibility | [Compatibility](./docs/COMPATIBILITY.md) | [兼容性](./docs/COMPATIBILITY.zh-CN.md) |
| Frequently asked questions | [FAQ](./docs/FAQ.md) | [常见问题](./docs/FAQ.zh-CN.md) |
| 0.2.0 release notes | [Release notes](./docs/RELEASE-NOTES-0.2.0.md) | [发布说明](./docs/RELEASE-NOTES-0.2.0.zh-CN.md) |
| Contributing | [Contributing](./CONTRIBUTING.md) | [贡献指南](./CONTRIBUTING.zh-CN.md) |
| Community governance | [Governance](./GOVERNANCE.md) | [治理规则](./GOVERNANCE.zh-CN.md) |

The public documentation above is sufficient to install, evaluate, build, and
contribute to TextDuet.

## Get Help And Contribute

Use [GitHub Discussions](https://github.com/frealcat/TextDuet/discussions) for setup help, provider questions, costs, and ideas. Use the issue forms for reproducible bugs, documentation fixes, feature requests, and website compatibility reports. Never include API keys, private URLs, account information, unpublished text, or screenshots containing sensitive content.

Contributions are welcome. Read [CONTRIBUTING.md](./CONTRIBUTING.md), [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md), and [GOVERNANCE.md](./GOVERNANCE.md). No CLA or DCO is required; by submitting a contribution, you license it under Apache-2.0 and represent that you have the right to do so.

## License

TextDuet is licensed under [Apache License 2.0](./LICENSE). Keep the accompanying [NOTICE](./NOTICE) and [third-party notices](./THIRD_PARTY_NOTICES.md) with redistributed copies.
