import { createCanvas } from '@napi-rs/canvas';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  fetchFollowersPfps,
  fetchGraphQL,
  generateGraph
} from '../src/fetchers/graph-fetcher.js';
import { fetchImages } from '../src/fetchers/images-fetcher.js';

const canvasMocks = vi.hoisted(() => {
  const drawImage = vi.fn();
  const toBuffer = vi.fn().mockReturnValue(Buffer.from('graph'));

  return {
    drawImage,
    toBuffer
  };
});

vi.mock('@napi-rs/canvas', () => ({
  createCanvas: vi.fn(() => ({
    getContext: vi.fn(() => ({
      drawImage: canvasMocks.drawImage
    })),
    toBuffer: canvasMocks.toBuffer
  }))
}));

vi.mock('../src/fetchers/images-fetcher.js', () => ({
  fetchImages: vi.fn()
}));

const headers = {
  Authorization: 'Bearer test-token'
};

const createFollowersResponse = (
  avatarUrls: string[],
  hasNextPage = false,
  endCursor: string | null = null
) => ({
  ok: true,
  statusText: 'OK',
  json: vi.fn().mockResolvedValue({
    data: {
      user: {
        followers: {
          pageInfo: {
            endCursor,
            hasNextPage
          },
          nodes: avatarUrls.map((avatarUrl) => ({
            avatarUrl
          }))
        }
      }
    }
  })
});

describe('fetchGraphQL', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('requests followers from the GitHub GraphQL API', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(createFollowersResponse(['avatar-1']));

    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchGraphQL('ale0aranda', headers);

    expect(result.user.followers.nodes).toEqual([
      {
        avatarUrl: 'avatar-1'
      }
    ]);

    expect(fetchMock).toHaveBeenCalledOnce();

    const [url, options] = fetchMock.mock.calls[0] ?? [];

    expect(url).toBe('https://api.github.com/graphql');
    expect(options).toMatchObject({
      headers,
      method: 'POST'
    });

    expect(options?.body).toContain('ale0aranda');
  });

  it('throws when GitHub returns an HTTP error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Unauthorized'
      })
    );

    await expect(fetchGraphQL('ale0aranda', headers)).rejects.toThrow(
      'Failed to fetch data from GitHub: Unauthorized'
    );
  });
});

describe('fetchFollowersPfps', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns avatar URLs', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(createFollowersResponse(['avatar-1', 'avatar-2']))
    );

    const result = await fetchFollowersPfps('ale0aranda', headers);

    expect(result).toEqual(['avatar-1', 'avatar-2']);
  });

  it('loads all pages until reaching the limit', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        createFollowersResponse(['avatar-1', 'avatar-2'], true, 'cursor-1')
      )
      .mockResolvedValueOnce(
        createFollowersResponse(['avatar-3', 'avatar-4'], false)
      );

    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchFollowersPfps('ale0aranda', headers, 3);

    expect(result).toEqual(['avatar-1', 'avatar-2', 'avatar-3']);

    expect(fetchMock).toHaveBeenCalledTimes(2);

    const secondRequest = fetchMock.mock.calls[1]?.[1];

    expect(secondRequest?.body).toContain('cursor-1');
  });

  it('returns an empty array when the limit is zero', async () => {
    const fetchMock = vi.fn();

    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchFollowersPfps('ale0aranda', headers, 0);

    expect(result).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects invalid pagination data', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(createFollowersResponse(['avatar-1'], true, null))
    );

    await expect(fetchFollowersPfps('ale0aranda', headers, 10)).rejects.toThrow(
      'GitHub returned an invalid pagination cursor'
    );
  });
});

describe('generateGraph', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('places avatars in rows and columns', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          createFollowersResponse(['avatar-1', 'avatar-2', 'avatar-3'])
        )
    );

    const images = [{ id: 1 }, { id: 2 }, { id: 3 }] as unknown as Awaited<
      ReturnType<typeof fetchImages>
    >;

    vi.mocked(fetchImages).mockResolvedValue(images);

    const result = await generateGraph('ale0aranda', 64, 2, headers);

    expect(createCanvas).toHaveBeenCalledWith(128, 128);

    expect(canvasMocks.drawImage).toHaveBeenNthCalledWith(
      1,
      images[0],
      0,
      0,
      64,
      64
    );

    expect(canvasMocks.drawImage).toHaveBeenNthCalledWith(
      2,
      images[1],
      64,
      0,
      64,
      64
    );

    expect(canvasMocks.drawImage).toHaveBeenNthCalledWith(
      3,
      images[2],
      0,
      64,
      64,
      64
    );

    expect(canvasMocks.toBuffer).toHaveBeenCalledWith('image/png');

    expect(result).toEqual(Buffer.from('graph'));
  });

  it('rejects an invalid image size', async () => {
    await expect(generateGraph('ale0aranda', 0, 10, headers)).rejects.toThrow(
      'Image size must be greater than zero'
    );
  });

  it('rejects an invalid row count', async () => {
    await expect(generateGraph('ale0aranda', 64, 0, headers)).rejects.toThrow(
      'Rows of images must be greater than zero'
    );
  });
});
