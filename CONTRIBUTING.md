# Contributing to TextDuet

[中文](./CONTRIBUTING.zh-CN.md)

Thank you for helping improve TextDuet. This is a local-first Chrome extension: changes must preserve the API-key boundary, minimal permissions, user control over provider costs, and safe webpage rendering.

## Before You Start

- Use [GitHub Discussions](https://github.com/frealcat/TextDuet/discussions) for questions and early ideas.
- Check existing issues before opening a new one. Use the relevant issue form for a reproducible bug, documentation change, feature idea, or website compatibility report.
- Read [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md), [SECURITY.md](./SECURITY.md), and the public [privacy policy](https://frealcat.github.io/TextDuet/privacy/).
- Do not report a vulnerability in a public issue. Follow `SECURITY.md` instead.

Internal planning documents are optional background, not contribution prerequisites. For implementation work, maintainers may point contributors to the architecture and focused design notes for the affected area.

## Development Setup

Requirements: Node.js 22 LTS or later, npm, and current stable Chrome.

```bash
git clone https://github.com/frealcat/TextDuet.git
cd TextDuet
npm ci
npm run typecheck
npm test
npm run build
```

Load `.output/chrome-mv3` through `chrome://extensions` with Developer mode enabled. See [development documentation](./docs/DEVELOPMENT.md) for browser checks, release checks, and local-provider rules.

Never put an API key in source files, test fixtures, screenshots, issues, pull requests, build output, or commit messages. Use the ignored `.env.local` only for user-run local validation; ordinary tests must use mocks and must not incur model-provider charges.

## Pull Requests

Keep each pull request focused and describe:

1. The user problem and its scope.
2. The approach and any behavior change.
3. Tests run and their results.
4. Permission, privacy, API-key, provider-cost, storage, or migration impact.
5. Documentation, screenshots, or release-note updates needed for user-visible changes.

Add focused tests for behavior changes. Do not weaken input validation, content-script boundaries, optional-origin permissions, or text-only rendering to make a test pass. New runtime dependencies, Manifest permissions, data collection, Provider protocols, or breaking data migrations require maintainer agreement before implementation.

## Documentation And Compatibility Reports

Keep English and Chinese public documentation aligned when changing user-facing behavior. Do not add private URLs, account data, page text that cannot be shared publicly, provider request bodies, API keys, or sensitive screenshots.

For webpage compatibility work, use public pages that do not require login. Do not bypass paywalls, CAPTCHAs, access controls, robots restrictions, or website security measures.

## License Of Contributions

TextDuet is licensed under Apache-2.0. No Contributor License Agreement (CLA) or Developer Certificate of Origin (DCO) is required.

By submitting a contribution, you confirm that you have the right to submit it and agree that your contribution is licensed under the [Apache License 2.0](./LICENSE), including its patent grant, under the same terms as the project.

## Review And Communication

The project follows the decision and review process in [GOVERNANCE.md](./GOVERNANCE.md). Maintainers may request tests, documentation, smaller commits, or design clarification before merging. Please keep discussion respectful and assume good intent.
