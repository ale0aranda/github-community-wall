# github-community-wall

Generate polished community walls from GitHub followers, contributors, sponsors, stargazers, watchers, and organization members.

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
github-community-wall contributors owner/repository --exclude-bots --sort contributions

# Public active sponsors
github-community-wall sponsors owner --background "#0d1117"

# Stargazers or watchers of a repository
github-community-wall stargazers owner/repository
github-community-wall watchers owner/repository
github-community-wall members organization

# A ready-to-upload 1500x500 X/Twitter banner
github-community-wall followers owner \
  --twitter-banner \
  --output assets/followers-banner.png
```

Run `github-community-wall --help` or `github-community-wall <command> --help`
for every option.

### CLI utilities

Create a starter configuration file:

```sh
github-community-wall config init
```

Validate the configuration file and GitHub token without printing the token:

```sh
github-community-wall doctor
github-community-wall doctor --json
```

Use `--quiet` in scripts when only the generated file matters, or `--verbose`
to print the resolved rendering options:

```sh
github-community-wall followers octocat --quiet
github-community-wall followers octocat --verbose
```

Cache GitHub responses and avatar downloads locally for faster regenerations:

```sh
github-community-wall followers octocat --cache-ttl 86400
github-community-wall followers octocat --refresh
github-community-wall followers octocat --offline
github-community-wall followers octocat --no-cache
```

Add a focused theme or project watermark with `--theme github-dark|github-light|neon|minimal`
and `--watermark "Built by the community"`.

Update a README while generating the wall. The command replaces an existing block
or appends one using stable markers:

```md
<!-- community-wall:start -->
<!-- community-wall:end -->
```

```sh
github-community-wall readme contributors owner/repository \
  --output assets/contributors.png \
  --theme github-dark \
  --watermark "Built by the community"
```

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
  "output": "assets/community-wall.png",
  "format": "png",
  "excludeBots": true,
  "sort": "login",
  "filterType": "user",
  "includeLoginPattern": "^(alice|bob)$",
  "minContributions": 10,
  "minFollowers": 50
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
`--format png|jpeg|webp|svg|html|json` (or inferred from `.png`, `.jpg`,
`.jpeg`, `.svg`, `.webp`, `.html`, or `.json` output paths). HTML is a
standalone document containing the avatar grid; JSON contains avatar metadata
and layout information. Use `--exclude-bots`, `--sort login|contributions`, `--filter-type all|user|organization|bot`, `--include-login`, `--exclude-login`, `--min-contributions`, `--max-contributions`, `--min-followers`, `--max-followers`, and `--limit` to control the input where GitHub provides the relevant metadata. Contributors exclude bots by default, and sources always omit users without an avatar URL.

Examples:

```sh
# Only regular users matching a pattern
github-community-wall followers octocat \
  --filter-type user \
  --include-login '^(alice|bob)$'

# Keep only active contributors with a minimum contribution threshold
github-community-wall contributors owner/repository \
  --filter-type user \
  --min-contributions 10 \
  --max-contributions 200

# Only include followers with a meaningful audience
github-community-wall followers octocat \
  --min-followers 100 \
  --max-followers 5000
```

The renderer supports configurable backgrounds, gaps, circular or square avatars, titles, and subtitles. `--dry-run --json` can be used to inspect the resolved input without writing an image.

## License

MIT
