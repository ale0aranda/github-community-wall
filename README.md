# github-community-wall

Generate polished PNG community walls from GitHub followers, contributors, sponsors, stargazers, and watchers.

![Followers wall](./assets/followers.png)

## Install

```sh
npm install -g github-community-wall
# or
pnpm add github-community-wall
```

The CLI requires Node.js 22.13 or newer.

## Authentication

Set a GitHub token in the environment:

```sh
export GITHUB_TOKEN=github_pat_...
```

The token is used for GitHub API requests and should have access to the data you
want to display. For public followers, contributors, stargazers, and watchers,
the default public repository/user access is enough. Sponsors require access to
the authenticated maintainer's sponsorship data.

You can also pass `--github-token`, but environment variables are safer because
the token will not appear in shell history or the process list.

## CLI examples

```sh
# Followers of the authenticated user
github-community-wall followers --output assets/followers.png

# Contributors, excluding bots by default
github-community-wall contributors owner/repository --limit 100

# Public active sponsors
github-community-wall sponsors owner --background "#0d1117"

# Stargazers or watchers of a repository
github-community-wall stargazers owner/repository
github-community-wall watchers owner/repository

# A ready-to-upload 1500x500 X/Twitter banner
github-community-wall followers owner \
  --twitter-banner \
  --output assets/followers-banner.png
```

Run `github-community-wall --help` or `github-community-wall <command> --help`
for every option.

## Configuration file

Commands can read defaults from `.community-wall.json` in the current directory:

```json
{
  "imageSize": 64,
  "columns": 10,
  "limit": 100,
  "background": "#0d1117",
  "gap": 2,
  "shape": "circle",
  "output": "assets/community-wall.png"
}
```

Use another file with `--config path/to/wall.json`. Command-line options always
override configuration values.

## GitHub Actions

This repository includes a workflow that regenerates its own walls daily. The
same pattern works in any repository:

```yaml
- uses: actions/checkout@v4
- uses: actions/setup-node@v4
  with:
    node-version: 22
- run: npx github-community-wall followers "$GITHUB_REPOSITORY_OWNER" \
    --output assets/followers.png
  env:
    GITHUB_TOKEN: ${{ github.token }}
```

## Library API

The package also exports the fetchers, renderers, GitHub error classes, and
TypeScript types:

```ts
import {
  createGitHubHeaders,
  fetchFollowersPfps,
  renderAvatarGrid
} from 'github-community-wall';

const headers = createGitHubHeaders(process.env.GITHUB_TOKEN!);
const avatars = await fetchFollowersPfps('octocat', headers, 50);
const png = await renderAvatarGrid(avatars, {
  columns: 10,
  imageSize: 64
});
```

## Output

PNG is the default output format. The output format can also be selected with
`--format png|svg|webp`, and is inferred from `.png`, `.svg`, or `.webp` output
paths when `--format` is omitted.

The renderer supports configurable backgrounds, gaps, circular or square
avatars, titles, and subtitles. `--dry-run --json` can be used to inspect the
resolved input without writing an image.

## License

MIT
