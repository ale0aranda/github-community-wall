import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export interface CacheOptions {
  directory?: string;
  ttl?: number;
  enabled?: boolean;
  refresh?: boolean;
  offline?: boolean;
}

let cacheOptions: Required<CacheOptions> = {
  directory: join(
    process.env['XDG_CACHE_HOME'] ?? join(process.env['HOME'] ?? '.', '.cache'),
    'github-community-wall'
  ),
  ttl: 86_400,
  enabled: false,
  refresh: false,
  offline: false
};

export const configureCache = (options: CacheOptions = {}): void => {
  cacheOptions = { ...cacheOptions, ...options };
};

const cacheKey = (url: string, init?: RequestInit): string => {
  const body = typeof init?.body === 'string' ? init.body : '';
  const token = String(
    init?.headers instanceof Headers
      ? (init.headers.get('authorization') ?? '')
      : ((init?.headers as Record<string, string> | undefined)?.[
          'authorization'
        ] ?? '')
  );
  return createHash('sha256')
    .update(`${init?.method ?? 'GET'}:${url}:${body}:${token}`)
    .digest('hex');
};

const pathsFor = (key: string): { body: string; meta: string } => ({
  body: join(cacheOptions.directory, `${key}.bin`),
  meta: join(cacheOptions.directory, `${key}.json`)
});

export const cachedFetch = async (
  input: string | URL,
  init?: RequestInit
): Promise<Response> => {
  if (!cacheOptions.enabled) {
    return fetch(input, init);
  }

  const key = cacheKey(input.toString(), init);
  const paths = pathsFor(key);

  if (!cacheOptions.refresh) {
    try {
      const metadata = JSON.parse(await readFile(paths.meta, 'utf8')) as {
        status: number;
        headers: Record<string, string>;
        createdAt: number;
      };
      const age = (Date.now() - metadata.createdAt) / 1000;
      if (age <= cacheOptions.ttl) {
        return new Response(await readFile(paths.body), {
          status: metadata.status,
          headers: metadata.headers
        });
      }
    } catch {
      // A missing or incomplete cache entry is a cache miss.
    }
  }

  if (cacheOptions.offline) {
    throw new Error(`No fresh cache entry available for ${input.toString()}`);
  }

  const response = await fetch(input, init);
  if (typeof response.arrayBuffer !== 'function' || !response.headers) {
    return response;
  }
  const body = Buffer.from(await response.arrayBuffer());
  await mkdir(dirname(paths.body), { recursive: true });
  await writeFile(paths.body, body);
  await writeFile(
    paths.meta,
    JSON.stringify({
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      createdAt: Date.now()
    })
  );
  return new Response(body, {
    status: response.status,
    headers: response.headers
  });
};
