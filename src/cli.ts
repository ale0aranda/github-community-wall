#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

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

interface FollowersOptions {
  columns: number;
  githubToken?: string;
  imageSize: number;
  limit: number;
  output: string;
}

const parsePositiveInteger = (value: string): number => {
  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new InvalidArgumentError('The value must be a positive integer');
  }

  return parsedValue;
};

const program = new Command();

program
  .name('github-community-wall')
  .description('Generate dynamic GitHub community walls')
  .version(VERSION)
  .showHelpAfterError();

program
  .command('followers')
  .description('Generate a community wall from GitHub followers')
  .argument('[username]', 'GitHub username; defaults to the authenticated user')
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

    const headers = createGitHubHeaders(options.githubToken);

    const resolvedUsername =
      username ?? (await fetchAuthenticatedUsername(headers));

    const graph = await generateGraph(
      resolvedUsername,
      options.imageSize,
      options.columns,
      headers,
      options.limit
    );

    const outputPath = resolve(options.output);

    await mkdir(dirname(outputPath), {
      recursive: true
    });

    await writeFile(outputPath, graph);

    process.stdout.write(`Community wall generated for @${resolvedUsername}\n`);

    process.stdout.write(`Saved to: ${outputPath}\n`);
  });

try {
  await program.parseAsync();
} catch (error) {
  const message =
    error instanceof Error ? error.message : 'An unknown error occurred';

  process.stderr.write(`Error: ${message}\n`);
  process.exitCode = 1;
}
