import { assertGitHubResponse } from '../errors.js';
import {
  renderAvatarGrid,
  validateAvatarGridOptions
} from '../renderer/avatar-grid-renderer.js';

import type { GitHubContributor } from '../types/globals.js';
import type { GitHubHeaders } from './graph-fetcher.js';

interface GitHubContributorResponse {
  avatar_url: string | null;
  contributions: number;
  login: string | null;
  type: string;
}

const hasNextPage = (linkHeader: string | null): boolean =>
  linkHeader?.includes('rel="next"') ?? false;

const isBot = (contributor: GitHubContributorResponse): boolean =>
  contributor.type === 'Bot' || contributor.login?.endsWith('[bot]') === true;

export const parseRepository = (
  repository: string
): {
  owner: string;
  name: string;
} => {
  const parts = repository.trim().split('/');

  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error('Repository must use the format owner/name');
  }

  return {
    owner: parts[0],
    name: parts[1]
  };
};

export const fetchContributors = async (
  repository: string,
  headers: GitHubHeaders,
  limit = 100,
  includeBots = false
): Promise<GitHubContributor[]> => {
  if (limit <= 0) {
    return [];
  }

  const { owner, name } = parseRepository(repository);

  const contributors: GitHubContributor[] = [];
  let page = 1;
  let shouldContinue = true;

  while (shouldContinue && contributors.length < limit) {
    const url = new URL(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/contributors`
    );

    url.searchParams.set('per_page', '100');
    url.searchParams.set('page', page.toString());

    const response = await fetch(url, {
      headers
    });

    assertGitHubResponse(response, `fetching contributors for ${repository}`);

    const pageContributors =
      (await response.json()) as GitHubContributorResponse[];

    for (const contributor of pageContributors) {
      if (!contributor.login || !contributor.avatar_url) {
        continue;
      }

      if (!includeBots && isBot(contributor)) {
        continue;
      }

      contributors.push({
        avatarUrl: contributor.avatar_url,
        contributions: contributor.contributions,
        login: contributor.login,
        type: contributor.type
      });

      if (contributors.length >= limit) {
        break;
      }
    }

    shouldContinue = hasNextPage(response.headers.get('link'));

    page += 1;
  }

  return contributors;
};

export const generateContributorsWall = async (
  repository: string,
  imageSize: number,
  columns: number,
  headers: GitHubHeaders,
  limit = 100,
  includeBots = false
): Promise<Buffer> => {
  const renderOptions = {
    columns,
    imageSize
  };

  validateAvatarGridOptions(renderOptions);

  const contributors = await fetchContributors(
    repository,
    headers,
    limit,
    includeBots
  );

  return renderAvatarGrid(
    contributors.map((contributor) => contributor.avatarUrl),
    renderOptions
  );
};
