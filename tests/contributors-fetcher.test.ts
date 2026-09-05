import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  fetchContributors,
  generateContributorsWall,
  parseRepository
} from '../src/fetchers/contributors-fetcher.js';
import { renderAvatarGrid } from '../src/renderer/avatar-grid-renderer.js';

vi.mock('../src/renderer/avatar-grid-renderer.js', () => ({
  renderAvatarGrid: vi.fn().mockResolvedValue(Buffer.from('wall')),
  validateAvatarGridOptions: vi.fn()
}));

const headers = {
  Authorization: 'Bearer test-token'
};

const createResponse = (
  contributors: unknown[],
  link: string | null = null
) => ({
  ok: true,
  statusText: 'OK',
  headers: {
    get: vi.fn().mockReturnValue(link)
  },
  json: vi.fn().mockResolvedValue(contributors)
});

describe('parseRepository', () => {
  it('parses an owner and repository name', () => {
    expect(parseRepository('ale0aranda/pyschool')).toEqual({
      owner: 'ale0aranda',
      name: 'pyschool'
    });
  });

  it('rejects an invalid repository', () => {
    expect(() => parseRepository('pyschool')).toThrow(
      'Repository must use the format owner/name'
    );
  });
});

describe('fetchContributors', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns repository contributors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        createResponse([
          {
            avatar_url: 'avatar-1',
            contributions: 20,
            login: 'developer',
            type: 'User'
          }
        ])
      )
    );

    const contributors = await fetchContributors(
      'ale0aranda/pyschool',
      headers
    );

    expect(contributors).toEqual([
      {
        avatarUrl: 'avatar-1',
        contributions: 20,
        login: 'developer',
        type: 'User'
      }
    ]);
  });

  it('excludes bots by default', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        createResponse([
          {
            avatar_url: 'bot-avatar',
            contributions: 10,
            login: 'dependabot[bot]',
            type: 'Bot'
          }
        ])
      )
    );

    const contributors = await fetchContributors(
      'ale0aranda/pyschool',
      headers
    );

    expect(contributors).toEqual([]);
  });

  it('includes bots when requested', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        createResponse([
          {
            avatar_url: 'bot-avatar',
            contributions: 10,
            login: 'dependabot[bot]',
            type: 'Bot'
          }
        ])
      )
    );

    const contributors = await fetchContributors(
      'ale0aranda/pyschool',
      headers,
      100,
      true
    );

    expect(contributors).toHaveLength(1);
  });

  it('throws when GitHub returns an error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Not Found'
      })
    );

    await expect(
      fetchContributors('ale0aranda/missing', headers)
    ).rejects.toThrow('Failed to fetch GitHub contributors: Not Found');
  });
});

describe('generateContributorsWall', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders contributor avatars', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        createResponse([
          {
            avatar_url: 'avatar-1',
            contributions: 20,
            login: 'developer',
            type: 'User'
          }
        ])
      )
    );

    const result = await generateContributorsWall(
      'ale0aranda/pyschool',
      64,
      10,
      headers
    );

    expect(renderAvatarGrid).toHaveBeenCalledWith(['avatar-1'], {
      columns: 10,
      imageSize: 64
    });

    expect(result).toEqual(Buffer.from('wall'));
  });
});
