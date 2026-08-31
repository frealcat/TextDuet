# Website Compatibility

[中文](./COMPATIBILITY.zh-CN.md)

TextDuet translates user-triggered, eligible reading text on ordinary HTTP and HTTPS webpages. It intentionally does not bypass login walls, paywalls, CAPTCHAs, protected browser pages, Chrome Web Store pages, or other access controls.

## Expected Boundaries

- Translation targets visible reading text; navigation links may be eligible where they are meaningful reading content.
- Buttons, form controls, editable fields, code, hidden content, and TextDuet's own inserted nodes are excluded.
- Dynamic and SPA pages are supported on a best-effort basis. A site can change its structure at any time.
- Translation begins only when the user starts it. No permanent all-site content script is installed.
- Stop translation if a page becomes unstable or if continuing could create unwanted Provider cost.

## Report A Public Site Problem

Use the website compatibility issue form when you can reproduce the problem on a public URL without a login. Include a short description, extension version, Chrome version, steps, expected result, and actual result.

Do not include API keys, private URLs, account information, restricted page text, full Provider requests/responses, or screenshots containing sensitive data. The extension can generate a local, redacted diagnostic preview; review it before downloading or attaching it anywhere.

## How We Handle Reports

Compatibility fixes are prioritized by severity, reproducibility, user impact, and whether a safe general solution exists. We may decline a page-specific rule if it would broaden webpage access, translate controls, reduce safety, or add ongoing maintenance disproportionate to the benefit.

For support questions rather than reproducible bugs, use [GitHub Discussions](https://github.com/frealcat/TextDuet/discussions).
