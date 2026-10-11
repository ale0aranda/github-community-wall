# Contributing

Thanks for helping improve `github-community-wall`.

## Before you start

1. Search open and closed issues to avoid duplicating work.
2. For a new feature or a behavior change, open an issue first when the scope
   is not obvious.
3. Never include GitHub tokens, private user data, or generated credentials in
   commits.

## Local setup

Requirements: Node.js 22.13+ and pnpm 11.

```sh
pnpm install
pnpm check
pnpm test
pnpm build
```

Useful commands:

- `pnpm test:watch` runs Vitest while editing.
- `pnpm test:coverage` checks the current test coverage.
- `pnpm format` applies the repository formatter.

## Pull requests

- Keep changes focused and explain the user-facing result.
- Add or update focused tests for behavior changes.
- Update README or CLI help when adding or changing an option.
- Add a changeset for publishable package changes with `pnpm changeset`.
- Confirm `pnpm check`, `pnpm test`, and `pnpm build` pass locally.

## Commit messages

Use the Conventional Commits style enforced by this repository, for example:
`feat: add organization member filtering` or `fix: handle empty avatar pages`.

By contributing, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
