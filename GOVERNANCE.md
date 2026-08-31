# Governance

[中文](./GOVERNANCE.zh-CN.md)

## Maintainer Model

TextDuet is currently maintained by a single project maintainer, **frealcat**. The maintainer is responsible for roadmap decisions, security response, release approval, repository settings, and accepting or declining contributions.

## How Decisions Are Made

Public discussion happens in GitHub Issues and Discussions. The maintainer considers user value, privacy, security, Chrome policy, maintenance cost, test coverage, and project scope. Significant changes to permissions, data handling, API-key storage, Provider protocols, dependencies, or release policy require an explicit documented decision before implementation.

The project does not promise a particular response time for feature requests or pull requests. Security reports follow the response target in [SECURITY.md](./SECURITY.md).

## Contribution Review

Pull requests need a clear purpose, scoped diff, relevant tests, and updated public documentation when users are affected. Maintainers may request revisions or close proposals that conflict with the local-first/BYOK model, minimal permissions, safety boundaries, or maintained scope.

## Maintainer Absence

If the maintainer is unavailable for 90 days with no public status update, contributors may fork the Apache-2.0 project and continue development under a new name. Repository administration, package identities, Chrome Web Store ownership, and project branding remain with their respective account owners unless formally transferred.

## Changes To This Document

Governance changes are made in a public pull request or a documented maintainer decision. The project will announce material changes through GitHub Releases or Discussions.
