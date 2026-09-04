import { defineConfig } from 'vitest/config';

/**
 * Safe default for ad-hoc `vitest` invocations: run unit tests only.
 * Database-backed tests intentionally use `vitest.integration.config.ts`
 * through `npm run test:integration` so unit work never requires PostgreSQL.
 */
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/unit/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});
