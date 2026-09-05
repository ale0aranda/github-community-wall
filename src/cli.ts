import {
  mkdir as mkdirFileSystem,
  writeFile as writeFileSystem
} from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { Command, InvalidArgumentError } from 'commander';

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

interface WallOptions {
  columns: number;
  githubToken?: string;
  imageSize: number;
  limit: number;
  output: string;
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
    includeBots: boolean
  ) => Promise<Buffer>;
  generateFollowersGraph: (
    username: string,
    imageSize: number,
    columns: number,
    headers: GitHubHeaders,
    limit: number
  ) => Promise<Buffer>;
  generateSponsorsGraph: (
    username: string,
    imageSize: number,
    columns: number,
    headers: GitHubHeaders,
    limit: number
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
      '-t, --github-token <token>',
      'GitHub personal access token',
      process.env['GITHUB_TOKEN']
    )
    .option('-o, --output <path>', 'Output PNG file', OUTPUT_FILE)
    .option(
      '-s, --image-size <pixels>',
      'Avatar size in pixels',
      parsePositiveInteger,
      IMAGE_SIZE
    )
    .option(
      '-c, --columns <count>',
      'Number of avatars per row',
      parsePositiveInteger,
      COLUMNS
    )
    .option(
      '-l, --limit <count>',
      limitDescription,
      parsePositiveInteger,
      FOLLOWERS_LIMIT
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

  followersCommand.action(
    async (username: string | undefined, options: WallOptions) => {
      const token = requireToken(options.githubToken);

      const headers = dependencies.createHeaders(token);

      const resolvedUsername = await resolveUsername(
        username,
        headers,
        dependencies
      );

      const graph = await dependencies.generateFollowersGraph(
        resolvedUsername,
        options.imageSize,
        options.columns,
        headers,
        options.limit
      );

      const outputPath = await saveGraph(graph, options.output, dependencies);

      writeResult(`@${resolvedUsername}`, outputPath, dependencies);
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
    async (repository: string, options: ContributorsOptions) => {
      const token = requireToken(options.githubToken);

      const headers = dependencies.createHeaders(token);

      const graph = await dependencies.generateContributorsGraph(
        repository,
        options.imageSize,
        options.columns,
        headers,
        options.limit,
        options.includeBots
      );

      const outputPath = await saveGraph(graph, options.output, dependencies);

      writeResult(repository, outputPath, dependencies);
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
    async (username: string | undefined, options: WallOptions) => {
      const token = requireToken(options.githubToken);

      const headers = dependencies.createHeaders(token);

      const resolvedUsername = await resolveUsername(
        username,
        headers,
        dependencies
      );

      const graph = await dependencies.generateSponsorsGraph(
        resolvedUsername,
        options.imageSize,
        options.columns,
        headers,
        options.limit
      );

      const outputPath = await saveGraph(graph, options.output, dependencies);

      writeResult(`@${resolvedUsername}`, outputPath, dependencies);
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
