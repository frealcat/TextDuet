# Security Policy

[中文](./SECURITY.zh-CN.md)

## Reporting A Vulnerability

Please do **not** report security vulnerabilities in public GitHub issues, Discussions, pull requests, screenshots, or social media.

Use one of these private channels instead:

- [GitHub private vulnerability reporting](https://github.com/frealcat/TextDuet/security/advisories/new)
- Email: [frealcat@gmail.com](mailto:frealcat@gmail.com)

Include a concise description, affected version or commit, reproduction steps, impact, and any proof of concept needed to understand the problem. Do not include a real API key, account credentials, private URLs, private page text, or unredacted request/response bodies. We will acknowledge a report within seven calendar days, provide status updates as the investigation progresses, and coordinate disclosure after a fix is available.

## Scope

Security reports are especially useful for issues involving:

- API-key, password, encryption, storage, or trusted-extension-context boundaries.
- Unauthorized webpage access, data exposure, message validation, or provider request construction.
- Remote code execution, unsafe model-output rendering, dependency compromise, or Manifest permission expansion.
- Persistent translation-cache access while the local Vault is locked.

The project does not offer a paid bounty program. Availability, provider output quality, model billing disagreements, website access restrictions, and unsupported browser behavior are normally support or compatibility issues, not security vulnerabilities.

## Supported Versions

While `0.2.0` is being prepared, reports against the `main` branch and its release candidates are supported and welcome. After publication, the current `0.2.x` release line will be the public supported line. Historical local-only `0.1.0` material was not publicly released and is retained only as project history.

## Security Design Boundaries

TextDuet is local-first and has no project-operated translation server. Users explicitly start translation; eligible page text is sent directly to their selected Provider. API keys are never returned to a webpage or content script. Session-mode keys clear after Chrome restarts; local-mode keys and persistent cache use a user-password-unlocked Vault. These controls reduce risk but do not make an extension or a third-party Provider invulnerable. Users should avoid sending sensitive material to a Provider whose policies they have not reviewed.
