import { extname } from 'node:path';

import { InvalidArgumentError } from 'commander';

import { configureCache } from '../cache.js';
import { loadConfig, mergeConfig } from '../config/config.js';
import {
  COLUMNS,
  FOLLOWERS_LIMIT,
  IMAGE_SIZE,
  OUTPUT_FILE
} from '../constants/const.js';

import type { Command } from 'commander';
import type { GitHubHeaders } from '../types/github-api.js';
import type { AvatarGridOptions } from '../types/render.js';
import type { UserFilterType } from '../types/user.js';
import type { CliDependencies } from './cli.js';

export interface WallOptions {
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
  filterType?: UserFilterType | undefined;
  includeLogin?: string | undefined;
  includeLoginPattern?: string | undefined;
  excludeLogin?: string | undefined;
  excludeLoginPattern?: string | undefined;
  minContributions?: number | undefined;
  maxContributions?: number | undefined;
  minFollowers?: number | undefined;
  maxFollowers?: number | undefined;
  quiet?: boolean | undefined;
  verbose?: boolean | undefined;
  cacheDir?: string | undefined;
  cacheTtl?: number | undefined;
  noCache?: boolean | undefined;
  refresh?: boolean | undefined;
  offline?: boolean | undefined;
  theme?: AvatarGridOptions['theme'];
  watermark?: string | undefined;
}

export interface ContributorsOptions extends WallOptions {
  includeBots: boolean;
}

export const parsePositiveInteger = (value: string): number => {
  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new InvalidArgumentError('The value must be a positive integer');
  }

  return parsedValue;
};

export const parseNonNegativeInteger = (value: string): number => {
  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue < 0) {
    throw new InvalidArgumentError('The value must be a non-negative integer');
  }

  return parsedValue;
};

export const addWallOptions = (
  command: Command,
  limitDescription: string
): Command =>
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
    .option(
      '--filter-type <type>',
      'Filter users by type: all, user, organization, or bot'
    )
    .option(
      '--include-login <pattern>',
      'Include only logins that match this regular expression'
    )
    .option(
      '--exclude-login <pattern>',
      'Exclude logins that match this regular expression'
    )
    .option(
      '--min-contributions <count>',
      'Only include contributors with at least this many contributions',
      parseNonNegativeInteger
    )
    .option(
      '--max-contributions <count>',
      'Only include contributors with at most this many contributions',
      parseNonNegativeInteger
    )
    .option(
      '--min-followers <count>',
      'Only include users with at least this many followers',
      parseNonNegativeInteger
    )
    .option(
      '--max-followers <count>',
      'Only include users with at most this many followers',
      parseNonNegativeInteger
    )
    .option('--quiet', 'Suppress success output')
    .option('--verbose', 'Print resolved options and progress details')
    .option('--cache-dir <path>', 'Local cache directory')
    .option(
      '--cache-ttl <seconds>',
      'Cache lifetime in seconds',
      parsePositiveInteger
    )
    .option('--no-cache', 'Disable local caching')
    .option('--refresh', 'Ignore cached responses and fetch fresh data')
    .option('--offline', 'Use only cached responses')
    .option(
      '--theme <theme>',
      'Visual theme (github-dark, github-light, neon, minimal)'
    )
    .option('--watermark <text>', 'Small branding text in the output')
    .option(
      '--dry-run',
      'Fetch data and print the result without writing an image'
    )
    .option('--json', 'Print machine-readable output');

export const resolveWallOptions = async (
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
  configureCache({
    ...(merged.cacheDir ? { directory: merged.cacheDir } : {}),
    ...(merged.cacheTtl ? { ttl: merged.cacheTtl } : {}),
    enabled: merged.noCache !== true,
    ...(merged.refresh !== undefined ? { refresh: merged.refresh } : {}),
    ...(merged.offline !== undefined ? { offline: merged.offline } : {})
  });

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

  if (
    merged.filterType
    && !['all', 'user', 'organization', 'bot'].includes(merged.filterType)
  ) {
    throw new InvalidArgumentError(
      'Filter type must be all, user, organization, or bot'
    );
  }

  if (
    merged.minContributions !== undefined
    && (merged.minContributions < 0
      || !Number.isInteger(merged.minContributions))
  ) {
    throw new InvalidArgumentError(
      'Minimum contributions must be a non-negative integer'
    );
  }

  if (
    merged.maxContributions !== undefined
    && (merged.maxContributions < 0
      || !Number.isInteger(merged.maxContributions))
  ) {
    throw new InvalidArgumentError(
      'Maximum contributions must be a non-negative integer'
    );
  }

  if (
    merged.minFollowers !== undefined
    && (merged.minFollowers < 0 || !Number.isInteger(merged.minFollowers))
  ) {
    throw new InvalidArgumentError(
      'Minimum followers must be a non-negative integer'
    );
  }

  if (
    merged.maxFollowers !== undefined
    && (merged.maxFollowers < 0 || !Number.isInteger(merged.maxFollowers))
  ) {
    throw new InvalidArgumentError(
      'Maximum followers must be a non-negative integer'
    );
  }

  if (
    merged.minContributions !== undefined
    && merged.maxContributions !== undefined
    && merged.minContributions > merged.maxContributions
  ) {
    throw new InvalidArgumentError(
      'Minimum contributions cannot be greater than maximum contributions'
    );
  }

  if (
    merged.minFollowers !== undefined
    && merged.maxFollowers !== undefined
    && merged.minFollowers > merged.maxFollowers
  ) {
    throw new InvalidArgumentError(
      'Minimum followers cannot be greater than maximum followers'
    );
  }

  if (
    merged.theme
    && !['github-dark', 'github-light', 'neon', 'minimal'].includes(
      merged.theme
    )
  ) {
    throw new InvalidArgumentError(
      'Theme must be github-dark, github-light, neon, or minimal'
    );
  }

  const includeLoginPattern = merged.includeLoginPattern ?? merged.includeLogin;
  const excludeLoginPattern = merged.excludeLoginPattern ?? merged.excludeLogin;

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
    filterType: merged.filterType,
    includeLogin: merged.includeLogin,
    includeLoginPattern,
    excludeLogin: merged.excludeLogin,
    excludeLoginPattern,
    minContributions: merged.minContributions,
    maxContributions: merged.maxContributions,
    minFollowers: merged.minFollowers,
    maxFollowers: merged.maxFollowers,
    quiet: merged.quiet,
    verbose: merged.verbose,
    cacheDir: merged.cacheDir,
    cacheTtl: merged.cacheTtl,
    noCache: merged.noCache,
    refresh: merged.refresh,
    offline: merged.offline,
    theme: merged.theme,
    watermark: merged.watermark
  };
};

export const getRenderOptions = (options: WallOptions): AvatarGridOptions => ({
  columns: options.columns,
  imageSize: options.imageSize,
  background: options.background,
  gap: options.gap,
  shape: options.shape,
  title: options.title,
  subtitle: options.subtitle,
  format: options.format,
  excludeBots: options.excludeBots,
  sort: options.sort,
  theme: options.theme,
  watermark: options.watermark,
  filterType: options.filterType,
  includeLoginPattern: options.includeLoginPattern,
  excludeLoginPattern: options.excludeLoginPattern,
  minContributions: options.minContributions,
  maxContributions: options.maxContributions,
  minFollowers: options.minFollowers,
  maxFollowers: options.maxFollowers
});

export const hasCustomRenderOptions = (options: WallOptions): boolean =>
  Boolean(
    options.background
      || options.gap !== undefined
      || options.shape
      || options.title
      || options.subtitle
      || options.sort
      || options.excludeBots !== undefined
      || options.filterType
      || options.includeLoginPattern
      || options.excludeLoginPattern
      || options.minContributions !== undefined
      || options.maxContributions !== undefined
      || options.minFollowers !== undefined
      || options.maxFollowers !== undefined
      || options.theme
      || options.watermark
      || (options.format && options.format !== 'png')
  );

export const requireToken = (token: string | undefined): string => {
  if (!token) {
    throw new InvalidArgumentError(
      'Missing GitHub token. Set GITHUB_TOKEN or use --github-token.'
    );
  }

  return token;
};

export const resolveUsername = async (
  username: string | undefined,
  headers: GitHubHeaders,
  dependencies: CliDependencies
): Promise<string> => username ?? (await dependencies.fetchUsername(headers));
