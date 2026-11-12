import { cachedFetch } from '../cache.js';
import {
  assertGitHubResponse,
  GitHubApiError,
  GitHubGraphQLError
} from '../errors/github-errors.js';

import type {
  FollowersData,
  GitHubGraphQLResponse,
  GitHubHeaders
} from '../types/github-api.js';
import type { GitHubFollower } from '../types/user.js';

export type { GitHubHeaders } from '../types/github-api.js';

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
