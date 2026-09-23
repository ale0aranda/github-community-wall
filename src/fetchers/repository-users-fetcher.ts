import { cachedFetch } from '../cache.js';
import { assertGitHubResponse } from '../errors.js';
import {
  renderAvatarGrid,
  validateAvatarGridOptions
} from '../renderer/avatar-grid-renderer.js';
import { applyUserFilter } from '../user-filters.js';

import type { GitHubHeaders } from './graph-fetcher.js';

interface RepositoryUser {
  avatar_url?: string;
  login?: string;
  type?: string;
}

const fetchRepositoryUsers = async (
  repository: string,
  endpoint: 'stargazers' | 'subscribers',
  headers: GitHubHeaders,
  limit: number
): Promise<RepositoryUser[]> => {
  const [owner, name] = repository.trim().split('/');
  if (!owner || !name || repository.trim().split('/').length !== 2) {
    throw new Error('Repository must use the format owner/name');
  }

  const users: RepositoryUser[] = [];
  let page = 1;

  while (users.length < limit) {
    const url = new URL(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/${endpoint}`
    );
    url.searchParams.set('per_page', '100');
    url.searchParams.set('page', page.toString());

    const response = await cachedFetch(url, { headers });
    assertGitHubResponse(response, `fetching ${endpoint} for ${repository}`);
    const pageUsers = (await response.json()) as RepositoryUser[];

    for (const user of pageUsers) {
      if (!user.avatar_url) {
        continue;
      }
      users.push(user);
      if (users.length >= limit) {
        break;
      }
    }
    if (pageUsers.length < 100) {
      break;
    }
    page += 1;
  }

  return users.slice(0, limit);
};

const fetchOrganizationMembersData = async (
  organization: string,
  headers: GitHubHeaders,
  limit = 100
): Promise<RepositoryUser[]> => {
  if (limit <= 0) {
    return [];
  }

  const members: RepositoryUser[] = [];
  let page = 1;

  while (members.length < limit) {
    const url = new URL(
      `https://api.github.com/orgs/${encodeURIComponent(organization)}/members`
    );
    url.searchParams.set('per_page', '100');
    url.searchParams.set('page', page.toString());

    const response = await cachedFetch(url, { headers });
    assertGitHubResponse(
      response,
      `fetching members for the ${organization} organization`
    );
    const pageMembers = (await response.json()) as RepositoryUser[];

    for (const member of pageMembers) {
      if (!member.avatar_url) {
        continue;
      }
      members.push(member);
      if (members.length >= limit) {
        break;
      }
    }
    if (pageMembers.length < 100) {
      break;
    }
    page += 1;
  }

  return members.slice(0, limit);
};

export const fetchOrganizationMembers = async (
  organization: string,
  headers: GitHubHeaders,
  limit = 100
): Promise<string[]> => {
  const members = await fetchOrganizationMembersData(
    organization,
    headers,
    limit
  );
  return members.map((member) => member.avatar_url ?? '');
};

export const fetchStargazers = async (
  repository: string,
  headers: GitHubHeaders,
  limit = 100
): Promise<string[]> => {
  if (limit <= 0) {
    return [];
  }

  const stargazers = await fetchRepositoryUsers(
    repository,
    'stargazers',
    headers,
    limit
  );

  return stargazers.map((user) => user.avatar_url ?? '');
};

export const fetchWatchers = async (
  repository: string,
  headers: GitHubHeaders,
  limit = 100
): Promise<string[]> => {
  if (limit <= 0) {
    return [];
  }

  const watchers = await fetchRepositoryUsers(
    repository,
    'subscribers',
    headers,
    limit
  );

  return watchers.map((user) => user.avatar_url ?? '');
};

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

  const users = await fetchRepositoryUsers(
    repository,
    source === 'stargazers' ? 'stargazers' : 'subscribers',
    headers,
    limit
  );

  const filteredUsers = applyUserFilter(users, {
    filterType: options.filterType,
    includeLoginPattern: options.includeLoginPattern,
    excludeLoginPattern: options.excludeLoginPattern
  });

  return renderAvatarGrid(
    filteredUsers.map((user) => user.avatar_url ?? ''),
    options
  );
};

export const generateOrganizationMembersWall = async (
  organization: string,
  imageSize: number,
  columns: number,
  headers: GitHubHeaders,
  limit = 100,
  options: Parameters<typeof renderAvatarGrid>[1] = { imageSize, columns }
): Promise<Buffer> => {
  validateAvatarGridOptions(options);
  const members = await fetchOrganizationMembersData(
    organization,
    headers,
    limit
  );
  const filteredMembers = applyUserFilter(members, {
    filterType: options.filterType,
    includeLoginPattern: options.includeLoginPattern,
    excludeLoginPattern: options.excludeLoginPattern
  });
  return renderAvatarGrid(
    filteredMembers.map((member) => member.avatar_url ?? ''),
    options
  );
};
