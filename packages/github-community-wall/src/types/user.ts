export type UserFilterType = 'all' | 'user' | 'organization' | 'bot';

export interface UserFilterConfig {
  filterType?: UserFilterType | undefined;
  includeLoginPattern?: string | undefined;
  excludeLoginPattern?: string | undefined;
  minContributions?: number | undefined;
  maxContributions?: number | undefined;
  minFollowers?: number | undefined;
  maxFollowers?: number | undefined;
}

export interface UserLike {
  login?: string | null;
  type?: string | null;
  contributions?: number | null;
  followers?: number | null;
}

export interface GitHubFollower {
  avatarUrl: string;
  login: string;
  type?: string;
  followers?: number;
  __typename?: string | null;
}

export interface GitHubGraphQLFollowerNode {
  avatarUrl: string;
  login?: string | null;
  followers?: {
    totalCount: number;
  } | null;
  __typename?: string | null;
}

export interface GitHubContributor {
  avatarUrl: string;
  contributions: number;
  login: string;
  type: string;
}

export interface GitHubSponsor {
  avatarUrl: string;
  login: string;
  type: 'Organization' | 'User';
}
