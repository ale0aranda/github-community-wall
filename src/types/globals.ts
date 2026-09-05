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

export interface GitHubGraphQLResponse {
  data: FollowersData;
}

export interface GitHubContributor {
  avatarUrl: string;
  contributions: number;
  login: string;
  type: string;
}
