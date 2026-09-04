import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createGitHubHeaders,
  fetchAuthenticatedUsername
} from '../src/github-client.js';

describe('createGitHubHeaders', () => {
  it('creates authenticated GitHub headers', () => {
    expect(createGitHubHeaders('test-token')).toEqual({
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer test-token',
      'Content-Type': 'application/json',
      'User-Agent': 'github-community-wall'
    });
  });
});

describe('fetchAuthenticatedUsername', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the authenticated username', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          login: 'ale0aranda'
        })
      })
    );

    const username = await fetchAuthenticatedUsername({
      Authorization: 'Bearer test-token'
    });

    expect(username).toBe('ale0aranda');
  });

  it('throws when authentication fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Unauthorized'
      })
    );

    await expect(
      fetchAuthenticatedUsername({
        Authorization: 'Bearer invalid'
      })
    ).rejects.toThrow(
      'Failed to fetch authenticated GitHub user: Unauthorized'
    );
  });

  it('rejects a response without a login', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({})
      })
    );

    await expect(
      fetchAuthenticatedUsername({
        Authorization: 'Bearer test-token'
      })
    ).rejects.toThrow('GitHub returned an invalid authenticated user');
  });
});
