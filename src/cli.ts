#!/usr/bin/env node

import {
  mkdir as mkdirFileSystem,
  writeFile as writeFileSystem
} from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { Command, InvalidArgumentError } from 'commander';

import {
  COLUMNS,
  FOLLOWERS_LIMIT,
  IMAGE_SIZE,
  OUTPUT_FILE,
  VERSION
} from './const.js';
import { generateGraph } from './fetchers/graph-fetcher.js';
import {
  createGitHubHeaders,
  fetchAuthenticatedUsername
} from './github-client.js';

import type { GitHubHeaders } from './fetchers/graph-fetcher.js';

interface FollowersOptions {
  columns: number;
  githubToken?: string;
  imageSize: number;
  limit: number;
  output: string;
}

export interface CliDependencies {
  createHeaders: (token: string) => GitHubHeaders;
  fetchUsername: (headers: GitHubHeaders) => Promise<string>;
  generateFollowersGraph: (
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
  generateFollowersGraph: generateGraph,
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

export const createCli = (
  dependencies: CliDependencies = defaultDependencies
): Command => {
  const program = new Command();

  program
    .name('github-community-wall')
    .description('Generate dynamic GitHub community walls')
    .version(VERSION)
    .showHelpAfterError();

  program
    .command('followers')
    .description('Generate a community wall from GitHub followers')
    .argument(
      '[username]',
      'GitHub username; defaults to the authenticated user'
    )
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
      'Maximum number of followers',
      parsePositiveInteger,
      FOLLOWERS_LIMIT
    )
    .action(async (username: string | undefined, options: FollowersOptions) => {
      if (!options.githubToken) {
        throw new InvalidArgumentError(
          'Missing GitHub token. Set GITHUB_TOKEN or use --github-token.'
        );
      }

      const headers = dependencies.createHeaders(options.githubToken);

      const resolvedUsername =
        username ?? (await dependencies.fetchUsername(headers));

      const graph = await dependencies.generateFollowersGraph(
        resolvedUsername,
        options.imageSize,
        options.columns,
        headers,
        options.limit
      );

      const outputPath = resolve(options.output);

      await dependencies.makeDirectory(dirname(outputPath));

      await dependencies.saveFile(outputPath, graph);

      dependencies.writeOutput(
        `Community wall generated for @${resolvedUsername}\n`
      );

      dependencies.writeOutput(`Saved to: ${outputPath}\n`);
    });

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

const entryPath = process.argv[1];

if (entryPath && import.meta.url === pathToFileURL(entryPath).href) {
  await runCli();
}
