import {
  mkdir as mkdirFileSystem,
  writeFile as writeFileSystem
} from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { Command, InvalidArgumentError } from 'commander';

import { loadConfig, mergeConfig } from './config.js';
import {
  COLUMNS,
  FOLLOWERS_LIMIT,
  IMAGE_SIZE,
  OUTPUT_FILE,
  VERSION
} from './const.js';
import { generateContributorsWall } from './fetchers/contributors-fetcher.js';
import { generateGraph } from './fetchers/graph-fetcher.js';
import { generateSponsorsWall } from './fetchers/sponsors-fetcher.js';
import {
  createGitHubHeaders,
  fetchAuthenticatedUsername
} from './github-client.js';

import type { GitHubHeaders } from './fetchers/graph-fetcher.js';
import type { AvatarGridOptions } from './renderer/avatar-grid-renderer.js';

interface WallOptions {
  columns: number;
  background?: string | undefined;
  config?: string | undefined;
  dryRun?: boolean | undefined;
  format?: 'png' | 'webp' | 'svg' | undefined;
  gap?: number | undefined;
  githubToken?: string | undefined;
  imageSize: number;
  limit: number;
  output: string;
  json?: boolean | undefined;
  shape?: 'square' | 'circle' | undefined;
  subtitle?: string | undefined;
  title?: string | undefined;
  twitterBanner?: boolean | undefined;
}

interface ContributorsOptions extends WallOptions {
  includeBots: boolean;
}

export interface CliDependencies {
  createHeaders: (token: string) => GitHubHeaders;
  fetchUsername: (headers: GitHubHeaders) => Promise<string>;
  generateContributorsGraph: (
    repository: string,
    imageSize: number,
    columns: number,
    headers: GitHubHeaders,
    limit: number,
    includeBots: boolean,
    options?: AvatarGridOptions
  ) => Promise<Buffer>;
  generateFollowersGraph: (
    username: string,
    imageSize: number,
    columns: number,
    headers: GitHubHeaders,
    limit: number,
    twitterBanner?: boolean,
    options?: AvatarGridOptions
  ) => Promise<Buffer>;
  generateSponsorsGraph: (
    username: string,
    imageSize: number,
    columns: number,
    headers: GitHubHeaders,
    limit: number,
    options?: AvatarGridOptions
  ) => Promise<Buffer>;
  generateRepositoryUsersGraph?: (
    repository: string,
    source: 'stargazers' | 'watchers',
    imageSize: number,
    columns: number,
    headers: GitHubHeaders,
    limit: number,
    options?: AvatarGridOptions
  ) => Promise<Buffer>;
  makeDirectory: (path: string) => Promise<void>;
  saveFile: (path: string, content: Buffer) => Promise<void>;
  writeOutput: (message: string) => void;
}

const defaultDependencies: CliDependencies = {
  createHeaders: createGitHubHeaders,
  fetchUsername: fetchAuthenticatedUsername,
  generateContributorsGraph: generateContributorsWall,
  generateFollowersGraph: generateGraph,
  generateSponsorsGraph: generateSponsorsWall,
  generateRepositoryUsersGraph: async (
    repository,
    source,
    imageSize,
    columns,
    headers,
    limit,
    options
  ) => {
    const { generateRepositoryUsersWall } = await import(
      './fetchers/repository-users-fetcher.js'
    );
    return generateRepositoryUsersWall(
      repository,
      source,
      imageSize,
      columns,
      headers,
      limit,
      options
    );
  },
  makeDirectory: async (path) => {
    await mkdirFileSystem(path, {
      recursive: true
    });
  },
  saveFile: async (path, content) => {
    await writeFileSystem(path, content);
  },
  writeOutput: (message) => {
    process.stdout.write(message);
  }
};

const parsePositiveInteger = (value: string): number => {
  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new InvalidArgumentError('The value must be a positive integer');
  }

  return parsedValue;
};

const addWallOptions = (command: Command, limitDescription: string): Command =>
  command
    .option(
      '--config <path>',
      'JSON configuration file',
      '.community-wall.json'
    )
    .option(
      '-t, --github-token <token>',
      'GitHub personal access token',
      process.env['GITHUB_TOKEN']
    )
    .option('-o, --output <path>', 'Output image file')
    .option(
      '-s, --image-size <pixels>',
      'Avatar size in pixels',
      parsePositiveInteger
    )
    .option(
      '-c, --columns <count>',
      'Number of avatars per row',
      parsePositiveInteger
    )
    .option('-l, --limit <count>', limitDescription, parsePositiveInteger)
    .option('--background <color>', 'Background color')
    .option('--gap <pixels>', 'Space between avatars', parsePositiveInteger)
    .option('--shape <shape>', 'Avatar shape (square or circle)')
    .option('--format <format>', 'Output format (png, webp, or svg)')
    .option('--title <text>', 'Optional title')
    .option('--subtitle <text>', 'Optional subtitle')
    .option(
      '--dry-run',
      'Fetch data and print the result without writing an image'
    )
    .option('--json', 'Print machine-readable output');

const resolveWallOptions = async (
  options: Partial<WallOptions>
): Promise<WallOptions> => {
  const config = await loadConfig(options.config);
  const merged = mergeConfig(config, options);
  return {
    columns: merged.columns ?? COLUMNS,
    githubToken: merged.githubToken ?? process.env['GITHUB_TOKEN'],
    imageSize: merged.imageSize ?? IMAGE_SIZE,
    limit: merged.limit ?? FOLLOWERS_LIMIT,
    output: merged.output ?? OUTPUT_FILE,
    background: merged.background,
    config: options.config,
    dryRun: merged.dryRun,
    format: merged.format,
    gap: merged.gap,
    json: merged.json,
    shape: merged.shape,
    subtitle: merged.subtitle,
    title: merged.title,
    twitterBanner: merged.twitterBanner
  };
};

const getRenderOptions = (options: WallOptions): AvatarGridOptions => ({
  columns: options.columns,
  imageSize: options.imageSize,
  background: options.background,
  gap: options.gap,
  shape: options.shape,
  title: options.title,
  subtitle: options.subtitle,
  format: options.format
});

const hasCustomRenderOptions = (options: WallOptions): boolean =>
  Boolean(
    options.background
      || options.gap !== undefined
      || options.shape
      || options.title
      || options.subtitle
      || options.format
  );

const requireToken = (token: string | undefined): string => {
  if (!token) {
    throw new InvalidArgumentError(
      'Missing GitHub token. Set GITHUB_TOKEN or use --github-token.'
    );
  }

  return token;
};

const resolveUsername = async (
  username: string | undefined,
  headers: GitHubHeaders,
  dependencies: CliDependencies
): Promise<string> => username ?? (await dependencies.fetchUsername(headers));

const saveGraph = async (
  graph: Buffer,
  output: string,
  dependencies: CliDependencies
): Promise<string> => {
  const outputPath = resolve(output);

  await dependencies.makeDirectory(dirname(outputPath));

  await dependencies.saveFile(outputPath, graph);

  return outputPath;
};

const writeResult = (
  subject: string,
  outputPath: string,
  dependencies: CliDependencies
): void => {
  dependencies.writeOutput(`Community wall generated for ${subject}\n`);

  dependencies.writeOutput(`Saved to: ${outputPath}\n`);
};

export const createCli = (
  dependencies: CliDependencies = defaultDependencies
): Command => {
  const program = new Command();

  program
    .name('github-community-wall')
    .description('Generate dynamic GitHub community walls')
    .version(VERSION)
    .addHelpText(
      'after',
      '\nExamples:\n'
        + '  $ github-community-wall followers octocat\n'
        + '  $ github-community-wall contributors owner/repository\n'
        + '  $ github-community-wall sponsors octocat --background "#0d1117"\n'
        + '  $ github-community-wall stargazers owner/repository\n'
    )
    .showHelpAfterError();

  const followersCommand = addWallOptions(
    program
      .command('followers')
      .description('Generate a community wall from GitHub followers')
      .argument(
        '[username]',
        'GitHub username; defaults to the authenticated user'
      ),
    'Maximum number of followers'
  );
  followersCommand.option(
    '--twitter-banner',
    'Generate a 1500x500 Twitter/X banner instead of a square wall'
  );

  followersCommand.action(
    async (username: string | undefined, rawOptions: WallOptions) => {
      const options = await resolveWallOptions(rawOptions);
      const token = requireToken(options.githubToken);

      const headers = dependencies.createHeaders(token);

      const resolvedUsername = await resolveUsername(
        username,
        headers,
        dependencies
      );

      const renderOptions = getRenderOptions(options);
      const graph = options.twitterBanner
        ? await dependencies.generateFollowersGraph(
            resolvedUsername,
            options.imageSize,
            options.columns,
            headers,
            options.limit,
            true,
            hasCustomRenderOptions(options) ? renderOptions : undefined
          )
        : hasCustomRenderOptions(options)
          ? await dependencies.generateFollowersGraph(
              resolvedUsername,
              options.imageSize,
              options.columns,
              headers,
              options.limit,
              false,
              renderOptions
            )
          : await dependencies.generateFollowersGraph(
              resolvedUsername,
              options.imageSize,
              options.columns,
              headers,
              options.limit
            );

      const outputPath = options.dryRun
        ? resolve(options.output)
        : await saveGraph(graph, options.output, dependencies);

      if (options.json) {
        dependencies.writeOutput(
          `${JSON.stringify({ subject: `@${resolvedUsername}`, output: outputPath, dryRun: options.dryRun })}\n`
        );
      } else {
        writeResult(`@${resolvedUsername}`, outputPath, dependencies);
      }
    }
  );

  const contributorsCommand = addWallOptions(
    program
      .command('contributors')
      .description('Generate a community wall from repository contributors')
      .argument('<repository>', 'GitHub repository in owner/name format')
      .option('--include-bots', 'Include bot accounts', false),
    'Maximum number of contributors'
  );

  contributorsCommand.action(
    async (repository: string, rawOptions: ContributorsOptions) => {
      const options = {
        ...(await resolveWallOptions(rawOptions)),
        includeBots: rawOptions.includeBots
      };
      const token = requireToken(options.githubToken);

      const headers = dependencies.createHeaders(token);

      const graph = hasCustomRenderOptions(options)
        ? await dependencies.generateContributorsGraph(
            repository,
            options.imageSize,
            options.columns,
            headers,
            options.limit,
            options.includeBots,
            getRenderOptions(options)
          )
        : await dependencies.generateContributorsGraph(
            repository,
            options.imageSize,
            options.columns,
            headers,
            options.limit,
            options.includeBots
          );

      const outputPath = options.dryRun
        ? resolve(options.output)
        : await saveGraph(graph, options.output, dependencies);

      if (options.json) {
        dependencies.writeOutput(
          `${JSON.stringify({ subject: repository, output: outputPath, dryRun: options.dryRun })}\n`
        );
      } else {
        writeResult(repository, outputPath, dependencies);
      }
    }
  );

  const sponsorsCommand = addWallOptions(
    program
      .command('sponsors')
      .description(
        'Generate a community wall from public active GitHub sponsors'
      )
      .argument(
        '[username]',
        'Sponsored GitHub username; defaults to the authenticated user'
      ),
    'Maximum number of sponsors'
  );

  sponsorsCommand.action(
    async (username: string | undefined, rawOptions: WallOptions) => {
      const options = await resolveWallOptions(rawOptions);
      const token = requireToken(options.githubToken);

      const headers = dependencies.createHeaders(token);

      const resolvedUsername = await resolveUsername(
        username,
        headers,
        dependencies
      );

      const graph = hasCustomRenderOptions(options)
        ? await dependencies.generateSponsorsGraph(
            resolvedUsername,
            options.imageSize,
            options.columns,
            headers,
            options.limit,
            getRenderOptions(options)
          )
        : await dependencies.generateSponsorsGraph(
            resolvedUsername,
            options.imageSize,
            options.columns,
            headers,
            options.limit
          );

      const outputPath = options.dryRun
        ? resolve(options.output)
        : await saveGraph(graph, options.output, dependencies);

      if (options.json) {
        dependencies.writeOutput(
          `${JSON.stringify({ subject: `@${resolvedUsername}`, output: outputPath, dryRun: options.dryRun })}\n`
        );
      } else {
        writeResult(`@${resolvedUsername}`, outputPath, dependencies);
      }
    }
  );

  for (const source of ['stargazers', 'watchers'] as const) {
    const repositoryCommand = addWallOptions(
      program
        .command(source)
        .description(`Generate a community wall from repository ${source}`)
        .argument('<repository>', 'GitHub repository in owner/name format'),
      `Maximum number of ${source}`
    );

    repositoryCommand.action(
      async (repository: string, rawOptions: WallOptions) => {
        const options = await resolveWallOptions(rawOptions);
        const token = requireToken(options.githubToken);
        const headers = dependencies.createHeaders(token);
        const renderOptions = getRenderOptions(options);
        if (!dependencies.generateRepositoryUsersGraph) {
          throw new Error(`The ${source} source is not configured`);
        }
        const graph = await dependencies.generateRepositoryUsersGraph(
          repository,
          source,
          options.imageSize,
          options.columns,
          headers,
          options.limit,
          hasCustomRenderOptions(options) ? renderOptions : undefined
        );
        const outputPath = options.dryRun
          ? resolve(options.output)
          : await saveGraph(graph, options.output, dependencies);

        if (options.json) {
          dependencies.writeOutput(
            `${JSON.stringify({ subject: repository, source, output: outputPath, dryRun: options.dryRun })}\n`
          );
        } else {
          writeResult(repository, outputPath, dependencies);
        }
      }
    );
  }

  return program;
};

export const runCli = async (
  argumentsToParse = process.argv
): Promise<void> => {
  try {
    await createCli().parseAsync(argumentsToParse);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'An unknown error occurred';

    process.stderr.write(`Error: ${message}\n`);
    process.exitCode = 1;
  }
};
