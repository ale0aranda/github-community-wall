import { describe, expect, it } from 'vitest';

import {
  assertGitHubResponse,
  GitHubApiError,
  GitHubAuthenticationError,
  GitHubNotFoundError,
  GitHubRateLimitError
} from '../src/errors.js';

const createResponse = (
  status: number,
  headers: Record<string, string> = {}
): Response =>
  new Response(null, {
    status,
    headers
  });

describe('assertGitHubResponse', () => {
  it('accepts successful responses', () => {
    expect(() =>
      assertGitHubResponse(createResponse(200), 'testing')
    ).not.toThrow();
  });

  it('identifies authentication errors', () => {
    expect(() =>
      assertGitHubResponse(
        createResponse(401),
        'fetching the authenticated user'
      )
    ).toThrow(GitHubAuthenticationError);
  });

  it('identifies missing resources', () => {
    expect(() =>
      assertGitHubResponse(createResponse(404), 'fetching contributors')
    ).toThrow(GitHubNotFoundError);
  });

  it('identifies rate limits', () => {
    const execute = () =>
      assertGitHubResponse(
        createResponse(403, {
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': '1_800_000_000'.replaceAll('_', '')
        }),
        'fetching followers'
      );

    expect(execute).toThrow(GitHubRateLimitError);

    try {
      execute();
    } catch (error) {
      expect(error).toBeInstanceOf(GitHubRateLimitError);

      expect((error as GitHubRateLimitError).resetAt).toEqual(
        new Date(1_800_000_000 * 1000)
      );
    }
  });

  it('preserves unexpected HTTP errors', () => {
    expect(() =>
      assertGitHubResponse(createResponse(500), 'fetching followers')
    ).toThrow(GitHubApiError);
  });
});
