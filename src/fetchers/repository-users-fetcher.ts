import { assertGitHubResponse } from '../errors.js';
import {
  renderAvatarGrid,
  validateAvatarGridOptions
} from '../renderer/avatar-grid-renderer.js';

import type { GitHubHeaders } from './graph-fetcher.js';

interface RepositoryUser {
  avatar_url?: string;
}

const fetchRepositoryUsers = async (
  repository: string,
  endpoint: 'stargazers' | 'subscribers',
  headers: GitHubHeaders,
  limit: number
): Promise<string[]> => {
  const [owner, name] = repository.trim().split('/');
  if (!owner || !name || repository.trim().split('/').length !== 2) {
    throw new Error('Repository must use the format owner/name');
  }

  const avatars: string[] = [];
  let page = 1;

  while (avatars.length < limit) {
    const url = new URL(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/${endpoint}`
    );
    url.searchParams.set('per_page', '100');
    url.searchParams.set('page', page.toString());

    const response = await fetch(url, { headers });
    assertGitHubResponse(response, `fetching ${endpoint} for ${repository}`);
    const users = (await response.json()) as RepositoryUser[];

    avatars.push(
      ...users.flatMap((user) => (user.avatar_url ? [user.avatar_url] : []))
    );
    if (users.length < 100) {
      break;
    }
    page += 1;
  }

  return avatars.slice(0, limit);
};

export const fetchStargazers = (
  repository: string,
  headers: GitHubHeaders,
  limit = 100
): Promise<string[]> =>
  limit <= 0
    ? Promise.resolve([])
    : fetchRepositoryUsers(repository, 'stargazers', headers, limit);

export const fetchWatchers = (
  repository: string,
  headers: GitHubHeaders,
  limit = 100
): Promise<string[]> =>
  limit <= 0
    ? Promise.resolve([])
    : fetchRepositoryUsers(repository, 'subscribers', headers, limit);

export const generateRepositoryUsersWall = async (
  repository: string,
  source: 'stargazers' | 'watchers',
  imageSize: number,
  columns: number,
  headers: GitHubHeaders,
  limit = 100,
  options: Parameters<typeof renderAvatarGrid>[1] = { imageSize, columns }
): Promise<Buffer> => {
  validateAvatarGridOptions(options);
  const avatars =
    source === 'stargazers'
      ? await fetchStargazers(repository, headers, limit)
      : await fetchWatchers(repository, headers, limit);
  return renderAvatarGrid(avatars, options);
};
