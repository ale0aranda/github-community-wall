import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  fetchOrganizationMembers,
  fetchStargazers,
  fetchWatchers,
  generateOrganizationMembersWall,
  generateRepositoryUsersWall
} from '../src/fetchers/repository-users-fetcher.js';
import {
  renderAvatarGrid,
  validateAvatarGridOptions
} from '../src/renderer/avatar-grid-renderer.js';

vi.mock('../src/renderer/avatar-grid-renderer.js', () => ({
  renderAvatarGrid: vi.fn().mockResolvedValue(Buffer.from('wall')),
  validateAvatarGridOptions: vi.fn()
}));

const headers = {
  Authorization: 'Bearer test-token'
};

const createResponse = (users: Array<{ avatar_url?: string }>, status = 200) =>
  new Response(JSON.stringify(users), {
    status,
    statusText: status === 200 ? 'OK' : 'Internal Server Error',
    headers: {
      'content-type': 'application/json'
    }
  });

describe('fetchStargazers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns stargazer avatar URLs', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        createResponse([
          { avatar_url: 'avatar-1' },
          {},
          { avatar_url: 'avatar-2' }
        ])
      );

    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchStargazers('owner/repository', headers);

    expect(result).toEqual(['avatar-1', 'avatar-2']);
    expect(fetchMock).toHaveBeenCalledOnce();

    const [url, options] = fetchMock.mock.calls[0] ?? [];

    expect(url).toEqual(
      new URL(
        'https://api.github.com/repos/owner/repository/stargazers?per_page=100&page=1'
      )
    );
    expect(options).toEqual({ headers });
  });

  it('returns an empty array for a zero limit', async () => {
    const fetchMock = vi.fn();

    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchStargazers('owner/repository', headers, 0);

    expect(result).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('loads multiple pages when the first page is full', async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({
      avatar_url: `avatar-${index}`
    }));

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(createResponse(firstPage))
      .mockResolvedValueOnce(createResponse([{ avatar_url: 'avatar-100' }]));

    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchStargazers('owner/repository', headers, 101);

    expect(result).toHaveLength(101);
    expect(result.at(-1)).toBe('avatar-100');
    expect(fetchMock).toHaveBeenCalledTimes(2);

    expect(fetchMock.mock.calls[1]?.[0]).toEqual(
      new URL(
        'https://api.github.com/repos/owner/repository/stargazers?per_page=100&page=2'
      )
    );
  });

  it('rejects an invalid repository format', async () => {
    await expect(fetchStargazers('invalid', headers)).rejects.toThrow(
      'Repository must use the format owner/name'
    );

    await expect(
      fetchStargazers('owner/repository/extra', headers)
    ).rejects.toThrow('Repository must use the format owner/name');
  });

  it('rejects GitHub API errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(null, {
          status: 404,
          statusText: 'Not Found'
        })
      )
    );

    await expect(fetchStargazers('owner/repository', headers)).rejects.toThrow(
      'GitHub resource not found while fetching stargazers for owner/repository'
    );
  });
});

describe('fetchWatchers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns watcher avatar URLs', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        createResponse([{ avatar_url: 'avatar-1' }, { avatar_url: 'avatar-2' }])
      );

    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchWatchers('owner/repository', headers);

    expect(result).toEqual(['avatar-1', 'avatar-2']);

    expect(fetchMock.mock.calls[0]?.[0]).toEqual(
      new URL(
        'https://api.github.com/repos/owner/repository/subscribers?per_page=100&page=1'
      )
    );
  });

  it('returns an empty array for a zero limit', async () => {
    const fetchMock = vi.fn();

    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchWatchers('owner/repository', headers, 0);

    expect(result).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('respects the requested limit', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          createResponse([
            { avatar_url: 'avatar-1' },
            { avatar_url: 'avatar-2' },
            { avatar_url: 'avatar-3' }
          ])
        )
    );

    const result = await fetchWatchers('owner/repository', headers, 2);

    expect(result).toEqual(['avatar-1', 'avatar-2']);
  });
});

describe('fetchOrganizationMembers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns organization member avatar URLs', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        createResponse([
          { avatar_url: 'avatar-1' },
          {},
          { avatar_url: 'avatar-2' }
        ])
      );

    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchOrganizationMembers('example-org', headers);

    expect(result).toEqual(['avatar-1', 'avatar-2']);

    expect(fetchMock.mock.calls[0]?.[0]).toEqual(
      new URL(
        'https://api.github.com/orgs/example-org/members?per_page=100&page=1'
      )
    );
  });

  it('returns an empty array for a zero limit', async () => {
    const fetchMock = vi.fn();

    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchOrganizationMembers('example-org', headers, 0);

    expect(result).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('loads multiple pages when the first page is full', async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({
      avatar_url: `avatar-${index}`
    }));

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(createResponse(firstPage))
      .mockResolvedValueOnce(createResponse([{ avatar_url: 'avatar-100' }]));

    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchOrganizationMembers('example-org', headers, 101);

    expect(result).toHaveLength(101);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    expect(fetchMock.mock.calls[1]?.[0]).toEqual(
      new URL(
        'https://api.github.com/orgs/example-org/members?per_page=100&page=2'
      )
    );
  });

  it('rejects GitHub API errors', async () => {
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
      fetchOrganizationMembers('example-org', headers)
    ).rejects.toThrow(
      'GitHub authentication failed while fetching members for the example-org organization'
    );
  });
});

describe('generateRepositoryUsersWall', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.mocked(renderAvatarGrid).mockClear();
    vi.mocked(validateAvatarGridOptions).mockClear();
  });

  it('generates a wall from stargazers', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(createResponse([{ avatar_url: 'avatar-1' }]))
    );

    const result = await generateRepositoryUsersWall(
      'owner/repository',
      'stargazers',
      64,
      4,
      headers
    );

    expect(validateAvatarGridOptions).toHaveBeenCalledWith({
      imageSize: 64,
      columns: 4
    });

    expect(renderAvatarGrid).toHaveBeenCalledWith(['avatar-1'], {
      imageSize: 64,
      columns: 4
    });

    expect(result).toEqual(Buffer.from('wall'));
  });

  it('generates a wall from watchers', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(createResponse([{ avatar_url: 'avatar-1' }]))
    );

    const options = {
      imageSize: 80,
      columns: 5,
      gap: 4,
      shape: 'circle' as const
    };

    const result = await generateRepositoryUsersWall(
      'owner/repository',
      'watchers',
      80,
      5,
      headers,
      25,
      options
    );

    expect(validateAvatarGridOptions).toHaveBeenCalledWith(options);
    expect(renderAvatarGrid).toHaveBeenCalledWith(['avatar-1'], options);
    expect(result).toEqual(Buffer.from('wall'));
  });
});

describe('generateOrganizationMembersWall', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.mocked(renderAvatarGrid).mockClear();
    vi.mocked(validateAvatarGridOptions).mockClear();
  });

  it('generates a wall from organization members', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          createResponse([
            { avatar_url: 'avatar-1' },
            { avatar_url: 'avatar-2' }
          ])
        )
    );

    const options = {
      imageSize: 96,
      columns: 3,
      background: '#0d1117'
    };

    const result = await generateOrganizationMembersWall(
      'example-org',
      96,
      3,
      headers,
      100,
      options
    );

    expect(validateAvatarGridOptions).toHaveBeenCalledWith(options);
    expect(renderAvatarGrid).toHaveBeenCalledWith(
      ['avatar-1', 'avatar-2'],
      options
    );
    expect(result).toEqual(Buffer.from('wall'));
  });
});
