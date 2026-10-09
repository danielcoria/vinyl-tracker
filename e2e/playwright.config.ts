// ============================================================================
// playwright.config.ts: SETTINGS FOR THE END-TO-END TESTS
//
// Run with: npm run test:e2e   (or npm run test:e2e:ui -w e2e for a visual runner)
//
// Before the tests, Playwright starts three things and waits until each answers:
//   1. a fake Discogs                       http://localhost:3199
//   2. the real server, on a fresh database http://localhost:3101
//   3. the real website (Vite)              http://localhost:5199
// Then a real Chromium browser clicks through the website like a person would.
// These ports are different from `npm run dev`, so both can run at the same time.
// ============================================================================

import { defineConfig, devices } from '@playwright/test';

const CI = Boolean(process.env.CI);

export default defineConfig({
  testDir: './tests',
  // One at a time: the tests share one database (and one stylus), so running
  // them side by side could make them trip over each other.
  workers: 1,
  fullyParallel: false,
  // On GitHub's machines, retry a failed test once before calling it failed.
  retries: CI ? 1 : 0,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  // On GitHub: "github" turns failures into notes on the run's page (readable without
  // downloading anything), plus a full HTML report saved when something fails.
  reporter: CI ? [['list'], ['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:5199',
    // On failure, keep a screenshot and a "trace" (a step-by-step recording).
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node support/fake-discogs.mjs',
      url: 'http://localhost:3199/health',
      reuseExistingServer: false,
    },
    {
      command: 'node support/start-server.mjs',
      url: 'http://localhost:3101/api/health',
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: 'npx vite --port 5199 --strictPort',
      cwd: '../client',
      url: 'http://localhost:5199',
      env: { API_URL: 'http://localhost:3101' },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
