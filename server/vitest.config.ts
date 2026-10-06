// ============================================================================
// vitest.config.ts: SETTINGS FOR SERVER TESTS
//
// Vitest is the tool that runs our tests (npm test). This says: run in Node
// (not a browser) and look for test files in server/test/.
// ============================================================================

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
