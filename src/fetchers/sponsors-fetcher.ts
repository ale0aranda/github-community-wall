import {
  assertGitHubResponse,
  GitHubApiError,
  GitHubGraphQLError
} from '../errors.js';
import {
  renderAvatarGrid,
  validateAvatarGridOptions
} from '../renderer/avatar-grid-renderer.js';

import type {
  GitHubSponsor,
  GitHubSponsorsGraphQLResponse,
  SponsorsData
} from '../types/globals.js';
import type { GitHubHeaders } from './graph-fetcher.js';

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

  const response = await fetch('https://api.github.com/graphql', {
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
        sponsors.push(node.sponsorEntity);
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

export const generateSponsorsWall = async (
  username: string,
  imageSize: number,
  columns: number,
  headers: GitHubHeaders,
  limit = 100
): Promise<Buffer> => {
  const renderOptions = {
    columns,
    imageSize
  };

  validateAvatarGridOptions(renderOptions);

  const sponsors = await fetchSponsors(username, headers, limit);

  return renderAvatarGrid(
    sponsors.map((sponsor) => sponsor.avatarUrl),
    renderOptions
  );
};
