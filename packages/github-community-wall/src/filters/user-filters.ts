import type {
  UserFilterConfig,
  UserFilterType,
  UserLike
} from '../types/user.js';

export type {
  UserFilterConfig,
  UserFilterType,
  UserLike
} from '../types/user.js';

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
    default:
      return true;
  }
};

const matchesMetricRange = (
  value: number | null | undefined,
  minimum: number | undefined,
  maximum: number | undefined
): boolean => {
  if (value === undefined || value === null) {
    return true;
  }

  if (minimum !== undefined && value < minimum) {
    return false;
  }

  if (maximum !== undefined && value > maximum) {
    return false;
  }

  return true;
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

    if (excludePattern?.test(login)) {
      return false;
    }

    if (
      !matchesMetricRange(
        user.contributions ?? null,
        config.minContributions,
        config.maxContributions
      )
    ) {
      return false;
    }

    if (
      !matchesMetricRange(
        user.followers ?? null,
        config.minFollowers,
        config.maxFollowers
      )
    ) {
      return false;
    }

    return true;
  });
};
