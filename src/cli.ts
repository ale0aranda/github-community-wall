import {
  access,
  mkdir as mkdirFileSystem,
  writeFile as writeFileSystem
} from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';

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
  format?: 'png' | 'jpeg' | 'webp' | 'svg' | 'html' | 'json' | undefined;
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
  excludeBots?: boolean | undefined;
  sort?: 'login' | 'contributions' | 'none' | undefined;
  quiet?: boolean | undefined;
  verbose?: boolean | undefined;
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
  generateOrganizationMembersGraph?: (
    organization: string,
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

const DEFAULT_CONFIG_CONTENT = `${JSON.stringify(
  {
    imageSize: IMAGE_SIZE,
    columns: COLUMNS,
    limit: FOLLOWERS_LIMIT,
    background: '#0d1117',
    gap: 2,
    shape: 'circle',
    output: OUTPUT_FILE,
    format: 'png',
    excludeBots: true,
    sort: 'login'
  },
  null,
  2
)}\n`;

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
  generateOrganizationMembersGraph: async (
    organization,
    imageSize,
    columns,
    headers,
    limit,
    options
  ) => {
    const { generateOrganizationMembersWall } = await import(
      './fetchers/repository-users-fetcher.js'
    );
    return generateOrganizationMembersWall(
      organization,
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

const parseNonNegativeInteger = (value: string): number => {
  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue < 0) {
    throw new InvalidArgumentError('The value must be a non-negative integer');
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
    .option('--gap <pixels>', 'Space between avatars', parseNonNegativeInteger)
    .option('--shape <shape>', 'Avatar shape (square or circle)')
    .option(
      '--format <format>',
      'Output format (png, jpeg, webp, svg, html, or json)'
    )
    .option('--title <text>', 'Optional title')
    .option('--subtitle <text>', 'Optional subtitle')
    .option('--exclude-bots', 'Exclude bot accounts where available')
    .option('--sort <field>', 'Sort by login or contributions')
    .option('--quiet', 'Suppress success output')
    .option('--verbose', 'Print resolved options and progress details')
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
  const output = merged.output ?? OUTPUT_FILE;
  const extensionFormat = extname(output).slice(1).toLowerCase();
  const inferredFormat = [
    'jpg',
    'jpeg',
    'svg',
    'webp',
    'html',
    'json'
  ].includes(extensionFormat)
    ? extensionFormat === 'jpg'
      ? 'jpeg'
      : extensionFormat
    : 'png';
  const format = merged.format ?? inferredFormat;

  if (!['png', 'jpeg', 'webp', 'svg', 'html', 'json'].includes(format)) {
    throw new InvalidArgumentError(
      'Format must be png, jpeg, webp, svg, html, or json'
    );
  }

  if (merged.shape && merged.shape !== 'square' && merged.shape !== 'circle') {
    throw new InvalidArgumentError('Shape must be square or circle');
  }

  if (
    merged.sort
    && merged.sort !== 'login'
    && merged.sort !== 'contributions'
    && merged.sort !== 'none'
  ) {
    throw new InvalidArgumentError(
      'Sort must be login, contributions, or none'
    );
  }

  return {
    columns: merged.columns ?? COLUMNS,
    githubToken: merged.githubToken ?? process.env['GITHUB_TOKEN'],
    imageSize: merged.imageSize ?? IMAGE_SIZE,
    limit: merged.limit ?? FOLLOWERS_LIMIT,
    output,
    background: merged.background,
    config: options.config,
    dryRun: merged.dryRun,
    format: format as WallOptions['format'],
    gap: merged.gap,
    json: merged.json,
    shape: merged.shape,
    subtitle: merged.subtitle,
    title: merged.title,
    twitterBanner: merged.twitterBanner,
    excludeBots: merged.excludeBots,
    sort: merged.sort,
    quiet: merged.quiet,
    verbose: merged.verbose
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
  format: options.format,
  excludeBots: options.excludeBots,
  sort: options.sort
});

const hasCustomRenderOptions = (options: WallOptions): boolean =>
  Boolean(
    options.background
      || options.gap !== undefined
      || options.shape
      || options.title
      || options.subtitle
      || options.sort
      || options.excludeBots !== undefined
      || (options.format && options.format !== 'png')
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

const writeVerbose = (
  options: WallOptions,
  dependencies: CliDependencies
): void => {
  if (!options.verbose || options.quiet) {
    return;
  }

  dependencies.writeOutput(
    `Options: ${JSON.stringify(
      {
        columns: options.columns,
        imageSize: options.imageSize,
        limit: options.limit,
        output: options.output,
        format: options.format,
        sort: options.sort,
        excludeBots: options.excludeBots
      },
      null,
      2
    )}\n`
  );
};

const writeSuccessResult = (
  subject: string,
  outputPath: string,
  options: WallOptions,
  dependencies: CliDependencies
): void => {
  if (!options.quiet) {
    writeResult(subject, outputPath, dependencies);
  }
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
        + '  $ github-community-wall members organization\n'
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
      writeVerbose(options, dependencies);
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
        writeSuccessResult(
          `@${resolvedUsername}`,
          outputPath,
          options,
          dependencies
        );
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
      writeVerbose(options, dependencies);
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
        writeSuccessResult(repository, outputPath, options, dependencies);
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
      writeVerbose(options, dependencies);
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
        writeSuccessResult(
          `@${resolvedUsername}`,
          outputPath,
          options,
          dependencies
        );
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
        writeVerbose(options, dependencies);
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
          writeSuccessResult(repository, outputPath, options, dependencies);
        }
      }
    );
  }

  const membersCommand = addWallOptions(
    program
      .command('members')
      .description('Generate a community wall from organization members')
      .argument('<organization>', 'GitHub organization login'),
    'Maximum number of organization members'
  );

  membersCommand.action(
    async (organization: string, rawOptions: WallOptions) => {
      const options = await resolveWallOptions(rawOptions);
      writeVerbose(options, dependencies);
      const token = requireToken(options.githubToken);
      const headers = dependencies.createHeaders(token);

      if (!dependencies.generateOrganizationMembersGraph) {
        throw new Error('The members source is not configured');
      }

      const graph = await dependencies.generateOrganizationMembersGraph(
        organization,
        options.imageSize,
        options.columns,
        headers,
        options.limit,
        hasCustomRenderOptions(options) ? getRenderOptions(options) : undefined
      );
      const outputPath = options.dryRun
        ? resolve(options.output)
        : await saveGraph(graph, options.output, dependencies);

      if (options.json) {
        dependencies.writeOutput(
          `${JSON.stringify({ subject: organization, source: 'members', output: outputPath, dryRun: options.dryRun })}\n`
        );
      } else {
        writeSuccessResult(organization, outputPath, options, dependencies);
      }
    }
  );

  const configInitCommand = program
    .command('config')
    .description('Manage community wall configuration')
    .command('init')
    .description('Create a starter .community-wall.json file')
    .argument('[path]', 'Configuration file path', '.community-wall.json')
    .option('--force', 'Overwrite an existing configuration file');

  configInitCommand.action(
    async (path: string, options: { force?: boolean | undefined }) => {
      const outputPath = resolve(path);

      if (!options.force) {
        try {
          await access(outputPath);
          throw new Error(
            `Configuration already exists at ${outputPath}; use --force to overwrite it`
          );
        } catch (error) {
          if (
            error instanceof Error
            && !error.message.includes('ENOENT')
            && !error.message.startsWith('Configuration already exists')
          ) {
            throw error;
          }
        }
      }

      await dependencies.makeDirectory(dirname(outputPath));
      await dependencies.saveFile(
        outputPath,
        Buffer.from(DEFAULT_CONFIG_CONTENT)
      );
      dependencies.writeOutput(`Created configuration: ${outputPath}\n`);
    }
  );

  const doctorCommand = program
    .command('doctor')
    .description('Validate token access and configuration')
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
    .option('--json', 'Print machine-readable output')
    .option('--quiet', 'Suppress success output');

  doctorCommand.action(
    async (options: {
      config: string;
      githubToken?: string | undefined;
      json?: boolean | undefined;
      quiet?: boolean | undefined;
    }) => {
      const checks = {
        config: 'ok' as 'ok' | 'error',
        token: 'error' as 'ok' | 'error',
        username: 'error' as 'ok' | 'error'
      };
      let errorMessage: string | undefined;

      try {
        await loadConfig(options.config);
      } catch (error) {
        checks.config = 'error';
        errorMessage =
          error instanceof Error ? error.message : 'Invalid configuration';
      }

      if (options.githubToken) {
        checks.token = 'ok';
        try {
          await dependencies.fetchUsername(
            dependencies.createHeaders(options.githubToken)
          );
          checks.username = 'ok';
        } catch (error) {
          errorMessage =
            error instanceof Error
              ? error.message
              : 'GitHub authentication failed';
        }
      } else {
        errorMessage =
          'Missing GitHub token. Set GITHUB_TOKEN or use --github-token.';
      }

      const result = {
        ok: Object.values(checks).every((status) => status === 'ok'),
        checks,
        ...(errorMessage ? { error: errorMessage } : {})
      };

      if (options.json) {
        dependencies.writeOutput(`${JSON.stringify(result)}\n`);
      } else if (!options.quiet || !result.ok) {
        dependencies.writeOutput(
          `${result.ok ? 'OK' : 'ERROR'}: ${JSON.stringify(result.checks)}${
            errorMessage ? `\n${errorMessage}` : ''
          }\n`
        );
      }

      if (!result.ok) {
        throw new Error(errorMessage ?? 'Doctor checks failed');
      }
    }
  );

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
