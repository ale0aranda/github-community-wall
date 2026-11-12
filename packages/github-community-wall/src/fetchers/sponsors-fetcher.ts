import { cachedFetch } from '../cache.js';
import {
  assertGitHubResponse,
  GitHubApiError,
  GitHubGraphQLError
} from '../errors/github-errors.js';

import type {
  GitHubHeaders,
  GitHubSponsorsGraphQLResponse,
  SponsorsData
} from '../types/github-api.js';
import type { GitHubSponsor } from '../types/user.js';

export const fetchSponsorsGraphQL = async (
  username: string,
  headers: GitHubHeaders,
  cursor: string | null = null
): Promise<SponsorsData> => {
  const query = `
    {
      user(login: ${JSON.stringify(username)}) {
        sponsorshipsAsMaintainer(
          first: 100
          after: ${JSON.stringify(cursor)}
          activeOnly: true
          includePrivate: false
        ) {
          pageInfo {
            endCursor
            hasNextPage
          }
          nodes {
            sponsorEntity {
              __typename
              ... on User {
                avatarUrl
                login
              }
              ... on Organization {
                avatarUrl
                login
              }
            }
          }
        }
      }
    }
  `;

  const response = await cachedFetch('https://api.github.com/graphql', {
    headers,
    method: 'POST',
    body: JSON.stringify({ query })
  });

  const context = `fetching sponsors for @${username}`;

  assertGitHubResponse(response, context);

  const json = (await response.json()) as GitHubSponsorsGraphQLResponse;

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

export const fetchSponsors = async (
  username: string,
  headers: GitHubHeaders,
  limit = 100
): Promise<GitHubSponsor[]> => {
  if (limit <= 0) {
    return [];
  }

  const sponsors: GitHubSponsor[] = [];
  let cursor: string | null = null;
  let hasNextPage = true;

  while (hasNextPage && sponsors.length < limit) {
    const data = await fetchSponsorsGraphQL(username, headers, cursor);

    const { nodes, pageInfo } = data.user.sponsorshipsAsMaintainer;

    for (const node of nodes) {
      if (node.sponsorEntity) {
        sponsors.push({
          avatarUrl: node.sponsorEntity.avatarUrl,
          login: node.sponsorEntity.login,
          type: (node.sponsorEntity.__typename ?? 'User') as
            | 'Organization'
            | 'User'
        });
      }

      if (sponsors.length >= limit) {
        break;
      }
    }

    cursor = pageInfo.endCursor;
    hasNextPage = pageInfo.hasNextPage;

    if (hasNextPage && !cursor) {
      throw new GitHubApiError(
        'GitHub returned an invalid sponsors pagination cursor',
        200
      );
    }
  }

  return sponsors.slice(0, limit);
};
