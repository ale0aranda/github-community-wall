import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  fetchSponsors,
  fetchSponsorsGraphQL,
  generateSponsorsWall
} from '../src/fetchers/sponsors-fetcher.js';
import { renderAvatarGrid } from '../src/renderer/avatar-grid-renderer.js';

vi.mock('../src/renderer/avatar-grid-renderer.js', () => ({
  renderAvatarGrid: vi.fn().mockResolvedValue(Buffer.from('wall')),
  validateAvatarGridOptions: vi.fn()
}));

const headers = {
  Authorization: 'Bearer test-token'
};

const createSponsorsResponse = (
  sponsors: {
    avatarUrl: string;
    login: string;
    type: 'Organization' | 'User';
  }[],
  hasNextPage = false,
  endCursor: string | null = null
) => ({
  ok: true,
  status: 200,
  statusText: 'OK',
  headers: new Headers(),
  json: vi.fn().mockResolvedValue({
    data: {
      user: {
        sponsorshipsAsMaintainer: {
          pageInfo: {
            endCursor,
            hasNextPage
          },
          nodes: sponsors.map((sponsor) => ({
            sponsorEntity: sponsor
          }))
        }
      }
    }
  })
});

describe('fetchSponsorsGraphQL', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('requests public active sponsors', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createSponsorsResponse([
        {
          avatarUrl: 'avatar-1',
          login: 'sponsor',
          type: 'User'
        }
      ])
    );

    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchSponsorsGraphQL('ale0aranda', headers);

    expect(result.user.sponsorshipsAsMaintainer.nodes).toHaveLength(1);

    const [, options] = fetchMock.mock.calls[0] ?? [];

    expect(options?.body).toContain('includePrivate: false');

    expect(options?.body).toContain('activeOnly: true');
  });

  it('rejects GraphQL errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: vi.fn().mockResolvedValue({
          errors: [
            {
              message: 'The user does not have a Sponsors listing'
            }
          ]
        })
      })
    );

    await expect(fetchSponsorsGraphQL('missing-user', headers)).rejects.toThrow(
      'GitHub GraphQL request failed while fetching sponsors for @missing-user'
    );
  });

  it('rejects missing user data', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: vi.fn().mockResolvedValue({
          data: {
            user: null
          }
        })
      })
    );

    await expect(fetchSponsorsGraphQL('missing-user', headers)).rejects.toThrow(
      'GitHub returned invalid GraphQL data while fetching sponsors for @missing-user'
    );
  });
});

describe('fetchSponsors', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns public sponsors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        createSponsorsResponse([
          {
            avatarUrl: 'avatar-1',
            login: 'sponsor-user',
            type: 'User'
          },
          {
            avatarUrl: 'avatar-2',
            login: 'sponsor-org',
            type: 'Organization'
          }
        ])
      )
    );

    const result = await fetchSponsors('ale0aranda', headers);

    expect(result).toEqual([
      {
        avatarUrl: 'avatar-1',
        login: 'sponsor-user',
        type: 'User'
      },
      {
        avatarUrl: 'avatar-2',
        login: 'sponsor-org',
        type: 'Organization'
      }
    ]);
  });

  it('loads multiple sponsor pages', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        createSponsorsResponse(
          [
            {
              avatarUrl: 'avatar-1',
              login: 'first-sponsor',
              type: 'User'
            }
          ],
          true,
          'cursor-1'
        )
      )
      .mockResolvedValueOnce(
        createSponsorsResponse([
          {
            avatarUrl: 'avatar-2',
            login: 'second-sponsor',
            type: 'Organization'
          }
        ])
      );

    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchSponsors('ale0aranda', headers, 2);

    expect(result).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const secondRequest = fetchMock.mock.calls[1]?.[1];

    expect(secondRequest?.body).toContain('cursor-1');
  });

  it('returns an empty array for a zero limit', async () => {
    const fetchMock = vi.fn();

    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchSponsors('ale0aranda', headers, 0);

    expect(result).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('generateSponsorsWall', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders sponsor avatars', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        createSponsorsResponse([
          {
            avatarUrl: 'avatar-1',
            login: 'sponsor',
            type: 'User'
          }
        ])
      )
    );

    const result = await generateSponsorsWall('ale0aranda', 64, 10, headers);

    expect(renderAvatarGrid).toHaveBeenCalledWith(['avatar-1'], {
      columns: 10,
      imageSize: 64
    });

    expect(result).toEqual(Buffer.from('wall'));
  });
});
