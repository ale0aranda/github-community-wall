export class GitHubApiError extends Error {
  public readonly status: number;

  public constructor(message: string, status: number) {
    super(message);
    this.name = new.target.name;
    this.status = status;
  }
}

export class GitHubGraphQLError extends GitHubApiError {
  public readonly errors: string[];

  public constructor(context: string, errors: string[]) {
    super(
      `GitHub GraphQL request failed while ${context}: ${errors.join('; ')}`,
      200
    );

    this.errors = errors;
  }
}

export class GitHubAuthenticationError extends GitHubApiError {
  public constructor(context: string) {
    super(`GitHub authentication failed while ${context}`, 401);
  }
}

export class GitHubNotFoundError extends GitHubApiError {
  public constructor(context: string) {
    super(`GitHub resource not found while ${context}`, 404);
  }
}

export class GitHubRateLimitError extends GitHubApiError {
  public readonly resetAt: Date | undefined;

  public constructor(context: string, status: number, resetAt?: Date) {
    const resetMessage = resetAt ? ` Resets at ${resetAt.toISOString()}.` : '';

    super(
      `GitHub rate limit exceeded while ${context}.${resetMessage}`,
      status
    );

    this.resetAt = resetAt;
  }
}

const getRateLimitReset = (response: Response): Date | undefined => {
  const resetHeader = response.headers.get('x-ratelimit-reset');

  if (!resetHeader) {
    return undefined;
  }

  const resetTimestamp = Number(resetHeader);

  if (!Number.isFinite(resetTimestamp)) {
    return undefined;
  }

  return new Date(resetTimestamp * 1000);
};

export const assertGitHubResponse = (
  response: Response,
  context: string
): void => {
  if (response.ok) {
    return;
  }

  if (response.status === 401) {
    throw new GitHubAuthenticationError(context);
  }

  if (response.status === 404) {
    throw new GitHubNotFoundError(context);
  }

  const remainingRequests = response.headers.get('x-ratelimit-remaining');

  if (
    response.status === 429
    || (response.status === 403 && remainingRequests === '0')
  ) {
    throw new GitHubRateLimitError(
      context,
      response.status,
      getRateLimitReset(response)
    );
  }

  const statusDescription = response.statusText || `HTTP ${response.status}`;

  throw new GitHubApiError(
    `GitHub request failed while ${context}: ${statusDescription}`,
    response.status
  );
};
