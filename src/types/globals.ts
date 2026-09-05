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
