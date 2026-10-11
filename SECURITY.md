# Security policy

## Reporting a vulnerability

Please do not report security vulnerabilities in a public issue. Use
[GitHub's private vulnerability reporting](https://github.com/ale0aranda/github-community-wall/security/advisories/new)
when available. If it is unavailable, contact the repository maintainer
privately through the email listed on the GitHub profile.

Include the affected version, reproduction steps, impact, and any suggested
mitigation. Please redact tokens and private data from reports.

## Token safety

The CLI accepts `GITHUB_TOKEN` or `--github-token`. Environment variables are
recommended because command-line arguments can be visible in shell history and
process listings. Use the smallest GitHub token permissions needed, rotate a
token immediately if it is exposed, and never commit it to a repository.

## Supported versions

Security fixes target the latest published version. Upgrade before reporting
an issue that may already be resolved.
