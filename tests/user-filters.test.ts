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
});
