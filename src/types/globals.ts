export interface GitHubFollower {
  avatarUrl: string;
}

export interface FollowersPageInfo {
  endCursor: string | null;
  hasNextPage: boolean;
}

export interface FollowersData {
  user: {
    followers: {
      pageInfo: FollowersPageInfo;
      nodes: GitHubFollower[];
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

export interface SponsorsData {
  user: {
    sponsorshipsAsMaintainer: {
      nodes: {
        sponsorEntity: GitHubSponsor | null;
      }[];
      pageInfo: FollowersPageInfo;
    };
  };
}

export interface GitHubSponsorsGraphQLResponse {
  data?: {
    user: SponsorsData['user'] | null;
  };
  errors?: GitHubGraphQLErrorItem[];
}
