export type GitHubHeaders = Record<string, string>;

export interface FollowersPageInfo {
  endCursor: string | null;
  hasNextPage: boolean;
}

export interface FollowersData {
  user: {
    followers: {
      pageInfo: FollowersPageInfo;
      nodes: {
        avatarUrl: string;
        login?: string | null;
        followers?: { totalCount: number } | null;
        __typename?: string | null;
      }[];
    };
  };
}

export interface SponsorsData {
  user: {
    sponsorshipsAsMaintainer: {
      nodes: {
        sponsorEntity: {
          avatarUrl: string;
          login: string;
          __typename?: string | null;
        } | null;
      }[];
      pageInfo: FollowersPageInfo;
    };
  };
}

export interface GitHubGraphQLErrorItem {
  message: string;
}

export interface GitHubGraphQLResponse {
  data?: {
    user: FollowersData['user'] | null;
  };
  errors?: GitHubGraphQLErrorItem[];
}

export interface GitHubFollowerGraphQLResponse {
  data?: {
    user: {
      followers: {
        pageInfo: FollowersPageInfo;
        nodes: {
          avatarUrl: string;
          login?: string | null;
          followers?: { totalCount: number } | null;
          __typename?: string | null;
        }[];
      };
    } | null;
  };
  errors?: GitHubGraphQLErrorItem[];
}

export interface GitHubSponsorsGraphQLResponse {
  data?: {
    user: SponsorsData['user'] | null;
  };
  errors?: GitHubGraphQLErrorItem[];
}
