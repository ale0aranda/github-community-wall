import { readFile } from 'node:fs/promises';

import type { AvatarGridOptions } from './renderer/avatar-grid-renderer.js';

type Optional<T> = {
  [Key in keyof T]?: T[Key] | undefined;
};

export interface WallConfig extends Optional<AvatarGridOptions> {
  format?: 'png' | 'jpeg' | 'webp' | 'svg' | 'html' | 'json' | undefined;
  shape?: 'square' | 'circle' | undefined;
  background?: string | undefined;
  gap?: number | undefined;
  imageSize?: number | undefined;
  columns?: number | undefined;
  title?: string | undefined;
  subtitle?: string | undefined;
  githubToken?: string | undefined;
  limit?: number | undefined;
  output?: string | undefined;
  includeBots?: boolean | undefined;
  excludeBots?: boolean | undefined;
  sort?: 'login' | 'contributions' | 'none' | undefined;
  twitterBanner?: boolean | undefined;
  dryRun?: boolean | undefined;
  json?: boolean | undefined;
}

const DEFAULT_CONFIG = '.community-wall.json';

export const loadConfig = async (
  path = DEFAULT_CONFIG
): Promise<WallConfig> => {
  try {
    const content = await readFile(path, 'utf8');
    const parsed: unknown = JSON.parse(content);

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Configuration must be a JSON object');
    }

    return parsed as WallConfig;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return {};
    }

    throw new Error(
      `Unable to read configuration file ${path}: ${
        error instanceof Error ? error.message : 'invalid JSON'
      }`
    );
  }
};

export const mergeConfig = (
  config: WallConfig,
  values: WallConfig
): WallConfig => ({
  ...config,
  ...Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined)
  )
});
