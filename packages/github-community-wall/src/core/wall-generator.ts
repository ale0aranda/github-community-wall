import { TWITTER_BANNER_LIMIT } from '../constants/const.js';
import { applyUserFilter } from '../filters/user-filters.js';
import {
  renderAvatarGrid,
  renderTwitterBanner,
  validateAvatarGridOptions
} from '../renderer/avatar-grid-renderer.js';

import type { GitHubHeaders } from '../types/github-api.js';
import type { AvatarGridOptions } from '../types/render.js';

export const generateFollowersWall = async (
  username: string,
  imageSize: number,
  columns: number,
  headers: GitHubHeaders,
  limit = 100,
  twitterBanner = false,
  options?: Partial<AvatarGridOptions>
): Promise<Buffer> => {
  const { fetchFollowers } = await import('../fetchers/followers-fetcher.js');

  const renderOptions = {
    columns,
    imageSize,
    ...options
  };

  validateAvatarGridOptions(renderOptions);

  const filteredFollowers = applyUserFilter(
    await fetchFollowers(
      username,
      headers,
      twitterBanner ? Math.min(limit, TWITTER_BANNER_LIMIT) : limit
    ),
    {
      filterType: options?.filterType,
      includeLoginPattern: options?.includeLoginPattern,
      excludeLoginPattern: options?.excludeLoginPattern,
      minContributions: options?.minContributions,
      maxContributions: options?.maxContributions,
      minFollowers: options?.minFollowers,
      maxFollowers: options?.maxFollowers
    }
  );

  const avatarUrls = filteredFollowers.map((follower) => follower.avatarUrl);

  if (twitterBanner) {
    return renderTwitterBanner(avatarUrls, {
      imageSize,
      background: options?.background,
      gap: options?.gap,
      shape: options?.shape,
      format:
        options?.format === 'html' || options?.format === 'json'
          ? 'png'
          : options?.format,
      theme: options?.theme,
      watermark: options?.watermark
    });
  }

  return renderAvatarGrid(avatarUrls, renderOptions);
};

export const generateContributorsWall = async (
  repository: string,
  imageSize: number,
  columns: number,
  headers: GitHubHeaders,
  limit = 100,
  includeBots = false,
  options?: Partial<AvatarGridOptions>
): Promise<Buffer> => {
  const { fetchContributors } = await import(
    '../fetchers/contributors-fetcher.js'
  );

  const renderOptions = {
    columns,
    imageSize,
    ...options
  };

  validateAvatarGridOptions(renderOptions);

  let contributors = await fetchContributors(
    repository,
    headers,
    limit,
    options?.excludeBots === undefined ? includeBots : !options.excludeBots
  );
  if (options?.sort === 'login') {
    contributors = [...contributors].sort((a, b) =>
      a.login.localeCompare(b.login)
    );
  } else if (options?.sort === 'contributions') {
    contributors = [...contributors].sort(
      (a, b) => b.contributions - a.contributions
    );
  }

  const filtered = applyUserFilter(contributors, {
    filterType: options?.filterType,
    includeLoginPattern: options?.includeLoginPattern,
    excludeLoginPattern: options?.excludeLoginPattern,
    minContributions: options?.minContributions,
    maxContributions: options?.maxContributions,
    minFollowers: options?.minFollowers,
    maxFollowers: options?.maxFollowers
  });

  return renderAvatarGrid(
    filtered.map((contributor) => contributor.avatarUrl),
    renderOptions
  );
};

export const generateSponsorsWall = async (
  username: string,
  imageSize: number,
  columns: number,
  headers: GitHubHeaders,
  limit = 100,
  options?: Partial<AvatarGridOptions>
): Promise<Buffer> => {
  const { fetchSponsors } = await import('../fetchers/sponsors-fetcher.js');

  const renderOptions = {
    columns,
    imageSize,
    ...options
  };

  validateAvatarGridOptions(renderOptions);

  const sponsors = applyUserFilter(
    await fetchSponsors(username, headers, limit),
    {
      filterType: options?.filterType,
      includeLoginPattern: options?.includeLoginPattern,
      excludeLoginPattern: options?.excludeLoginPattern
    }
  );

  return renderAvatarGrid(
    sponsors.map((sponsor) => sponsor.avatarUrl),
    renderOptions
  );
};

export const generateRepositoryUsersWall = async (
  repository: string,
  source: 'stargazers' | 'watchers',
  imageSize: number,
  columns: number,
  headers: GitHubHeaders,
  limit = 100,
  options: AvatarGridOptions = { imageSize, columns }
): Promise<Buffer> => {
  const { fetchStargazers, fetchWatchers } = await import(
    '../fetchers/repository-users-fetcher.js'
  );

  validateAvatarGridOptions(options);

  const fetchFn = source === 'stargazers' ? fetchStargazers : fetchWatchers;
  const avatarUrls = await fetchFn(repository, headers, limit);

  return renderAvatarGrid(avatarUrls, options);
};

export const generateOrganizationMembersWall = async (
  organization: string,
  imageSize: number,
  columns: number,
  headers: GitHubHeaders,
  limit = 100,
  options: AvatarGridOptions = { imageSize, columns }
): Promise<Buffer> => {
  const { fetchOrganizationMembers } = await import(
    '../fetchers/repository-users-fetcher.js'
  );

  validateAvatarGridOptions(options);

  const avatarUrls = await fetchOrganizationMembers(
    organization,
    headers,
    limit
  );

  return renderAvatarGrid(avatarUrls, options);
};
