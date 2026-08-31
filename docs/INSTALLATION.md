# Install And Update TextDuet

[中文](./INSTALLATION.zh-CN.md)

TextDuet `0.2.0` is planned for three distribution channels. The Chrome Web
Store will be the recommended path for normal use once its listing is public;
GitHub Releases and source builds are intended for advanced users, testers, and
contributors.

## 1. Chrome Web Store

When the `0.2.0` listing is public, install TextDuet from the Chrome Web Store and keep automatic updates enabled. The Store is the only channel that supplies Chrome-managed automatic updates.

After installation:

1. Pin TextDuet from Chrome's Extensions menu if desired.
2. Open TextDuet Options.
3. Select a Provider, enter its HTTPS API endpoint and model, then add your API key.
4. Choose **session only** for an ephemeral key, or create/unlock the local Vault if you want encrypted local persistence.
5. Test the connection and start with a short, public webpage.

TextDuet does not provide model credits. Requests may be billed by your Provider.

## 2. GitHub Release ZIP

Download the matching `textduet-<version>-chrome.zip` and `SHA256SUMS.txt` from [GitHub Releases](https://github.com/frealcat/TextDuet/releases). Verify the checksum if possible.

1. Unpack the ZIP. Chrome cannot load a ZIP file directly.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Select **Load unpacked**.
5. Choose the unpacked directory that contains `manifest.json`.

Updates for a manually loaded build are manual: download the next release, unpack it to a new directory, reload or replace the extension in `chrome://extensions`, and re-open Options. Keep your old unpacked directory until the new build works.

## 3. Build From Source

Requirements: Node.js 22 LTS or later, npm, and stable Chrome.

```bash
git clone https://github.com/frealcat/TextDuet.git
cd TextDuet
npm ci
npm run build
```

Load `.output/chrome-mv3` through **Load unpacked** in `chrome://extensions`. For full local verification, run:

```bash
npm run release:check
```

The generated `.output/` directory is local build output and is not a release source of truth. Follow the [development guide](./DEVELOPMENT.md) when modifying or validating the project.

## Storage And Migration Boundaries

- Chrome Web Store, manually loaded release ZIPs, and locally built extensions may have different extension IDs and separate Chrome storage.
- Do not expect API keys, Vault material, translation cache, budget settings, or usage history to move automatically between those installations.
- Session-only keys clear when Chrome restarts.
- The local Vault stores local-mode keys and persistent translation cache encrypted at rest. Its password is never stored; after a Chrome restart, unlock it again before those encrypted records can be used.
- Before deleting an old extension installation, confirm the new installation works. Treat any local storage transfer as unsupported unless a future release explicitly provides a migration flow.

## Update And Rollback

- **Store:** Chrome updates the extension. If an update changes the local data format, read the release notes before opening Options.
- **Manual ZIP or source build:** retain a known-good unpacked directory before loading the next build. To roll back, re-load that old directory; this does not guarantee data compatibility across versions.
- Never copy browser extension storage folders or Vault records by hand. Doing so can break encryption, data integrity, or extension identity boundaries.

## Help

For setup help, use [GitHub Discussions](https://github.com/frealcat/TextDuet/discussions). For reproducible problems, use an issue form after removing API keys, passwords, private URLs, account information, and sensitive page content. See [Support](../SUPPORT.md) and [FAQ](./FAQ.md).
