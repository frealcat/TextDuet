# Frequently Asked Questions

[中文](./FAQ.zh-CN.md)

## Is TextDuet free?

TextDuet has no extension subscription fee. Your model Provider may charge for API usage, and its billing, rate limits, retention, and terms are outside TextDuet's control.

## Does TextDuet see my API key or translated pages?

TextDuet has no project-operated translation server. Eligible page text is sent directly to the Provider you select when you start a translation. API keys are not sent to webpages or Translator Script. Read the [Privacy Policy](https://frealcat.github.io/TextDuet/privacy/) for details.

## What is the difference between session mode and the Vault?

Session mode keeps an API key only for the current Chrome session and clears it after a browser restart. The local Vault encrypts local-mode keys and persistent translation-cache records at rest with a password you enter. The password is never stored; a restart locks the Vault until you unlock it again.

## Why is the persistent cache unavailable?

Persistent cache is part of the local Vault. It is unavailable while the Vault is locked, after a restart until unlocked, or if you clear/delete it. A current page can still reuse translations held only in memory for that page session.

## Why does Chrome ask for a provider permission?

TextDuet requests the specific HTTPS Origin of the API endpoint you configure so it can call that Provider. It does not receive permanent access to all websites. See [Chrome permissions](./CHROME-PERMISSIONS.md).

## Can I translate every webpage?

No. Chrome and websites may restrict extension injection. TextDuet does not bypass access controls and intentionally excludes forms, buttons, code, hidden content, and other interactive areas. See [compatibility guidance](./COMPATIBILITY.md).

## How do I install a GitHub Release ZIP?

Unpack it first, then load the directory containing `manifest.json` with Developer mode enabled at `chrome://extensions`. Chrome cannot load the ZIP itself. GitHub-loaded builds update manually. See [installation instructions](./INSTALLATION.md).

## Where should I ask for help or report a bug?

Use [GitHub Discussions](https://github.com/frealcat/TextDuet/discussions) for help and ideas, and issue forms for reproducible bugs or public-site compatibility reports. Never post secrets or sensitive pages. Security reports belong in [private channels](../SECURITY.md).
