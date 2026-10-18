import { cachedFetch } from '../cache.js';
import { TWITTER_BANNER_LIMIT } from '../const.js';
import {
  assertGitHubResponse,
  GitHubApiError,
  GitHubGraphQLError
} from '../errors.js';
import {
  renderAvatarGrid,
  renderTwitterBanner,
  validateAvatarGridOptions
} from '../renderer/avatar-grid-renderer.js';
import { applyUserFilter } from '../user-filters.js';

import type { AvatarGridOptions } from '../renderer/avatar-grid-renderer.js';
import type {
  FollowersData,
  GitHubFollower,
  GitHubGraphQLResponse
} from '../types/globals.js';

export type GitHubHeaders = Record<string, string>;

export const fetchGraphQL = async (
  username: string,
  headers: GitHubHeaders,
  cursor: string | null = null
): Promise<FollowersData> => {
  const query = `
    {
      user(login: ${JSON.stringify(username)}) {
        followers(first: 100, after: ${JSON.stringify(cursor)}) {
          pageInfo {
            endCursor
            hasNextPage
          }
          nodes {
            avatarUrl
            login
            followers {
              totalCount
            }
            __typename
          }
        }
      }
    }
  `;

  const response = await cachedFetch('https://api.github.com/graphql', {
    headers,
    method: 'POST',
    body: JSON.stringify({
      query
    })
  });

  const context = `fetching followers for @${username}`;

  assertGitHubResponse(response, context);

  const json = (await response.json()) as GitHubGraphQLResponse;

  if (json.errors?.length) {
    throw new GitHubGraphQLError(
      context,
      json.errors.map((error) => error.message)
    );
  }

  if (!json.data?.user) {
    throw new GitHubApiError(
      `GitHub returned invalid GraphQL data while ${context}`,
      response.status
    );
  }

  return {
    user: json.data.user
  };
};

export const fetchFollowersPfps = async (
  username: string,
  headers: GitHubHeaders,
  limit = 100
): Promise<string[]> => {
  const followers = await fetchFollowers(username, headers, limit);
  return followers.map((follower) => follower.avatarUrl);
};

export const fetchFollowers = async (
  username: string,
  headers: GitHubHeaders,
  limit = 100
): Promise<GitHubFollower[]> => {
  if (limit <= 0) {
    return [];
  }

  const followers: GitHubFollower[] = [];
  let cursor: string | null = null;
  let hasNextPage = true;

  while (hasNextPage && followers.length < limit) {
    const followersData = await fetchGraphQL(username, headers, cursor);

    const { nodes, pageInfo } = followersData.user.followers;

    for (const node of nodes) {
      if (!node.avatarUrl) {
        continue;
      }

      const followerNode = node as typeof node & {
        followers?: { totalCount?: number } | null;
      };

      followers.push({
        avatarUrl: node.avatarUrl,
        login: node.login ?? `follower-${followers.length}`,
        type: node.__typename ?? 'User',
        followers: followerNode.followers?.totalCount ?? 0
      });

      if (followers.length >= limit) {
        break;
      }
    }

    cursor = pageInfo.endCursor;
    hasNextPage = pageInfo.hasNextPage;

    if (hasNextPage && !cursor) {
      throw new GitHubApiError(
        'GitHub returned an invalid pagination cursor',
        200
      );
    }
  }

  return followers.slice(0, limit);
};

export const generateGraph = async (
  username: string,
  imageSize: number,
  columns: number,
  headers: GitHubHeaders,
  limit = 100,
  twitterBanner = false,
  options?: Partial<AvatarGridOptions>
): Promise<Buffer> => {
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
