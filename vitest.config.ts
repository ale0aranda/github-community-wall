import { defineConfig, mergeConfig } from 'vitest/config';

import rulesConfig from '@ale0aranda/rules/vitest/node';

export default mergeConfig(
  rulesConfig,
  defineConfig({
    test: {
      mockReset: false,
      restoreMocks: false,
      coverage: {
        include: [
          'src/fetchers/**/*.ts',
          'src/renderer/**/*.ts',
          'src/github-client.ts'
        ]
      }
    }
  })
);
