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

import type { AvatarGridOptions } from '../renderer/avatar-grid-renderer.js';
import type { FollowersData, GitHubGraphQLResponse } from '../types/globals.js';

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
  if (limit <= 0) {
    return [];
  }

  const avatarUrls: string[] = [];
  let cursor: string | null = null;
  let hasNextPage = true;

  while (hasNextPage && avatarUrls.length < limit) {
    const followersData = await fetchGraphQL(username, headers, cursor);

    const { nodes, pageInfo } = followersData.user.followers;

    avatarUrls.push(...nodes.map((node) => node.avatarUrl));

    cursor = pageInfo.endCursor;
    hasNextPage = pageInfo.hasNextPage;

    if (hasNextPage && !cursor) {
      throw new GitHubApiError(
        'GitHub returned an invalid pagination cursor',
        200
      );
    }
  }

  return avatarUrls.slice(0, limit);
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

  const avatarUrls = await fetchFollowersPfps(
    username,
    headers,
    twitterBanner ? Math.min(limit, TWITTER_BANNER_LIMIT) : limit
  );

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
