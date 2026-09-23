export type UserFilterType = 'all' | 'user' | 'organization' | 'bot';

export interface UserFilterConfig {
  filterType?: UserFilterType | undefined;
  includeLoginPattern?: string | undefined;
  excludeLoginPattern?: string | undefined;
}

export interface UserLike {
  login?: string | null;
  type?: string | null;
}

const matchesType = (user: UserLike, filterType: UserFilterType): boolean => {
  const login = user.login ?? '';
  const lowerType = (user.type ?? '').toLowerCase();
  const isBot = lowerType === 'bot' || login.endsWith('[bot]');
  const isOrganization = lowerType === 'organization';
  const isUser = !isBot && !isOrganization;

  switch (filterType) {
    case 'bot':
      return isBot;
    case 'organization':
      return isOrganization;
    case 'user':
      return isUser;
    case 'all':
    default:
      return true;
  }
};

export const applyUserFilter = <T extends UserLike>(
  users: T[],
  config: UserFilterConfig = {}
): T[] => {
  const includePattern = config.includeLoginPattern
    ? new RegExp(config.includeLoginPattern, 'i')
    : null;
  const excludePattern = config.excludeLoginPattern
    ? new RegExp(config.excludeLoginPattern, 'i')
    : null;

  return users.filter((user) => {
    const login = user.login ?? '';

    if (config.filterType && config.filterType !== 'all') {
      if (!matchesType(user, config.filterType)) {
        return false;
      }
    }

    if (includePattern && !includePattern.test(login)) {
      return false;
    }

    if (excludePattern && excludePattern.test(login)) {
      return false;
    }

    return true;
  });
};
