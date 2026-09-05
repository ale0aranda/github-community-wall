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
      vi.fn().mockResolvedValue(
        new Response(null, {
          status: 401,
          statusText: 'Unauthorized'
        })
      )
    );

    await expect(
      fetchAuthenticatedUsername({
        Authorization: 'Bearer invalid'
      })
    ).rejects.toThrow(
      'GitHub authentication failed while fetching the authenticated user'
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
