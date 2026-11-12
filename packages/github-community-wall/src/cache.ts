import { createCache } from './cache/cache.js';

export { createCache } from './cache/cache.js';

export type { CacheInstance, CacheOptions } from './cache/cache.js';

import type { CacheOptions } from './cache/cache.js';

let currentCache = createCache();

export const configureCache = (options: CacheOptions = {}): void => {
  currentCache = createCache(options);
};

export const cachedFetch = (
  input: string | URL,
  init?: RequestInit
): Promise<Response> => currentCache.fetch(input, init);
