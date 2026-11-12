import {
  access,
  mkdir as mkdirFileSystem,
  readFile as readFileSystem,
  writeFile as writeFileSystem
} from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { Command, InvalidArgumentError } from 'commander';

import { loadConfig } from '../config/config.js';
import {
  COLUMNS,
  FOLLOWERS_LIMIT,
  IMAGE_SIZE,
  OUTPUT_FILE,
  VERSION
} from '../constants/const.js';
import {
  generateContributorsWall,
  generateFollowersWall,
  generateOrganizationMembersWall,
  generateRepositoryUsersWall,
  generateSponsorsWall
} from '../core/wall-generator.js';
import {
  createGitHubHeaders,
  fetchAuthenticatedUsername
} from '../github/github-client.js';
import {
  addWallOptions,
  getRenderOptions,
  hasCustomRenderOptions,
  requireToken,
  resolveUsername,
  resolveWallOptions
} from './options.js';
import {
  escapeRegExp,
  relativePath,
  saveGraph,
  writeSuccessResult,
  writeVerbose
} from './output.js';

import type { GitHubHeaders } from '../types/github-api.js';
import type { AvatarGridOptions } from '../types/render.js';
import type { ContributorsOptions, WallOptions } from './options.js';

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
  generateFollowersGraph: generateFollowersWall,
  generateSponsorsGraph: generateSponsorsWall,
  generateRepositoryUsersGraph: generateRepositoryUsersWall,
  generateOrganizationMembersGraph: generateOrganizationMembersWall,
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

  const readmeCommand = addWallOptions(
    program
      .command('readme')
      .description('Generate a wall and update README markers')
      .argument(
        '<source>',
        'Source: followers, contributors, sponsors, stargazers, watchers, or members'
      )
      .argument('[subject]', 'Username, repository, or organization')
      .option('--readme-path <path>', 'README file to update', 'README.md'),
    'Maximum number of community members'
  );

  readmeCommand.action(
    async (
      source: string,
      subject: string | undefined,
      rawOptions: WallOptions & { readmePath: string }
    ) => {
      const allowedSources = [
        'followers',
        'contributors',
        'sponsors',
        'stargazers',
        'watchers',
        'members'
      ];
      if (!allowedSources.includes(source)) {
        throw new InvalidArgumentError(
          `Source must be one of: ${allowedSources.join(', ')}`
        );
      }

      const options = await resolveWallOptions(rawOptions);
      writeVerbose(options, dependencies);
      const token = requireToken(options.githubToken);
      const headers = dependencies.createHeaders(token);
      const renderOptions = getRenderOptions(options);
      const resolvedSubject =
        source === 'followers' || source === 'sponsors'
          ? await resolveUsername(subject, headers, dependencies)
          : subject;

      if (!resolvedSubject) {
        throw new InvalidArgumentError(
          `${source} requires a username, repository, or organization`
        );
      }

      let graph: Buffer;
      if (source === 'followers') {
        graph = await dependencies.generateFollowersGraph(
          resolvedSubject,
          options.imageSize,
          options.columns,
          headers,
          options.limit,
          false,
          renderOptions
        );
      } else if (source === 'sponsors') {
        graph = await dependencies.generateSponsorsGraph(
          resolvedSubject,
          options.imageSize,
          options.columns,
          headers,
          options.limit,
          renderOptions
        );
      } else if (source === 'contributors') {
        graph = await dependencies.generateContributorsGraph(
          resolvedSubject,
          options.imageSize,
          options.columns,
          headers,
          options.limit,
          false,
          renderOptions
        );
      } else if (source === 'members') {
        if (!dependencies.generateOrganizationMembersGraph) {
          throw new Error('The members source is not configured');
        }
        graph = await dependencies.generateOrganizationMembersGraph(
          resolvedSubject,
          options.imageSize,
          options.columns,
          headers,
          options.limit,
          renderOptions
        );
      } else {
        if (!dependencies.generateRepositoryUsersGraph) {
          throw new Error(`The ${source} source is not configured`);
        }
        graph = await dependencies.generateRepositoryUsersGraph(
          resolvedSubject,
          source as 'stargazers' | 'watchers',
          options.imageSize,
          options.columns,
          headers,
          options.limit,
          renderOptions
        );
      }

      const outputPath = await saveGraph(graph, options.output, dependencies);
      const readmePath = resolve(rawOptions.readmePath);
      const readme = await readFileSystem(readmePath, 'utf8');
      const markerStart = '<!-- community-wall:start -->';
      const markerEnd = '<!-- community-wall:end -->';
      const relativeOutput = `./${relativePath(readmePath, outputPath)}`;
      const block = `${markerStart}\n![Community wall](${relativeOutput})\n${markerEnd}`;
      const markerPattern = new RegExp(
        `${escapeRegExp(markerStart)}[\\s\\S]*?${escapeRegExp(markerEnd)}`
      );
      const updatedReadme = markerPattern.test(readme)
        ? readme.replace(markerPattern, block)
        : `${readme.trimEnd()}\n\n${block}\n`;
      await writeFileSystem(readmePath, updatedReadme);
      dependencies.writeOutput(`Updated README: ${readmePath}\n`);
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
