import { assertGitHubResponse, GitHubApiError } from './errors.js';

import type { GitHubHeaders } from './fetchers/graph-fetcher.js';

interface GitHubUser {
  login: string;
}

export const createGitHubHeaders = (token: string): GitHubHeaders => ({
  Accept: 'application/vnd.github+json',
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
  'User-Agent': 'github-community-wall'
});

export const fetchAuthenticatedUsername = async (
  headers: GitHubHeaders
): Promise<string> => {
  const response = await fetch('https://api.github.com/user', {
    headers
  });

  assertGitHubResponse(response, 'fetching the authenticated user');

  const user = (await response.json()) as Partial<GitHubUser>;

  if (!user.login) {
    throw new GitHubApiError(
      'GitHub returned an invalid authenticated user',
      response.status
    );
  }

  return user.login;
};
