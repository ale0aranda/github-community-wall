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
  status: 200,
  statusText: 'OK',
  headers: {
    get: vi.fn().mockReturnValue(link)
  },
  json: vi.fn().mockResolvedValue(contributors)
});

describe('parseRepository', () => {
  it('parses an owner and repository name', () => {
    expect(parseRepository('ale0aranda/github-community-wall')).toEqual({
      owner: 'ale0aranda',
      name: 'github-community-wall'
    });
  });

  it('rejects an invalid repository', () => {
    expect(() => parseRepository('invalid')).toThrow(
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
      'ale0aranda/github-community-wall',
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
      'ale0aranda/github-community-wall',
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
      'ale0aranda/github-community-wall',
      headers,
      100,
      true
    );

    expect(contributors).toHaveLength(1);
  });

  it('returns an empty array for a zero limit', async () => {
    const fetchMock = vi.fn();

    vi.stubGlobal('fetch', fetchMock);

    const contributors = await fetchContributors(
      'ale0aranda/github-community-wall',
      headers,
      0
    );

    expect(contributors).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws when GitHub returns an error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(null, {
          status: 404,
          statusText: 'Not Found'
        })
      )
    );

    await expect(
      fetchContributors('ale0aranda/missing', headers)
    ).rejects.toThrow(
      'GitHub resource not found while fetching contributors for ale0aranda/missing'
    );
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
      'ale0aranda/github-community-wall',
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
