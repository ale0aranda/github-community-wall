import { describe, expect, it } from 'vitest';

import { applyUserFilter } from '../src/user-filters.js';

describe('user filters', () => {
  it('filters by type and login regex', () => {
    const users = [
      { login: 'alice', type: 'User' },
      { login: 'bot-runner', type: 'Bot' },
      { login: 'acme-org', type: 'Organization' },
      { login: 'zack', type: 'User' }
    ];

    expect(
      applyUserFilter(users, {
        filterType: 'user',
        includeLoginPattern: '^(a|z)',
        excludeLoginPattern: '^z'
      })
    ).toEqual([{ login: 'alice', type: 'User' }]);
  });

  it('filters by contribution and follower counts', () => {
    const users = [
      { login: 'alice', type: 'User', contributions: 8, followers: 50 },
      { login: 'bob', type: 'User', contributions: 12, followers: 120 },
      { login: 'charlie', type: 'User', contributions: 20, followers: 200 }
    ];

    expect(
      applyUserFilter(users, {
        minContributions: 10,
        maxContributions: 15,
        minFollowers: 100
      })
    ).toEqual([
      { login: 'bob', type: 'User', contributions: 12, followers: 120 }
    ]);
  });
});
