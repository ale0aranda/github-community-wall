import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { InvalidArgumentError, program } from 'commander';

import { IMAGE_SIZE, OUT_FILE, ROWS_OF_IMAGES } from './const.js';
import { generateGraph } from './fetchers/graph-fetcher.js';

interface GitHubUser {
  login: string;
}

program
  .option(
    '-g, --github-token <GITHUB_TOKEN>',
    'GitHub personal access token',
    process.env['GITHUB_TOKEN']
  )
  .option(
    '-s, --image-size <SIZE>',
    'Avatar size in pixels',
    IMAGE_SIZE.toString()
  )
  .option(
    '-r, --rows-of-images <ROWS>',
    'Number of avatars per row',
    ROWS_OF_IMAGES.toString()
  )
  .parse();

const { githubToken, imageSize, rowsOfImages } = program.opts<{
  githubToken?: string;
  imageSize: string;
  rowsOfImages: string;
}>();

if (!githubToken) {
  throw new InvalidArgumentError('Missing required option: --github-token');
}

const sizeToUse = Number(imageSize) || IMAGE_SIZE;
const rowsToUse = Number(rowsOfImages) || ROWS_OF_IMAGES;

export const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${githubToken}`
};

const response = await fetch('https://api.github.com/user', {
  headers
});

if (!response.ok) {
  throw new Error(`Failed to fetch GitHub user: ${response.statusText}`);
}

const user = (await response.json()) as GitHubUser;
const graph = await generateGraph(user.login, sizeToUse, rowsToUse);

const outputDirectory = dirname(OUT_FILE);

if (!existsSync(outputDirectory)) {
  mkdirSync(outputDirectory, { recursive: true });
}

writeFileSync(OUT_FILE, graph);

console.log(`Graph saved to: ${OUT_FILE}`);
