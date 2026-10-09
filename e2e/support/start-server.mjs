// ============================================================================
// start-server.mjs: STARTS THE REAL SERVER FOR THE END-TO-END TESTS
//
// Every test run gets a brand-new, empty database (e2e/.tmp/e2e.db), so your
// own records are never touched and runs don't affect each other. The server
// is told to use the fake Discogs (fake-discogs.mjs) and its own port.
// ============================================================================

import { spawn } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const tmp = fileURLToPath(new URL('../.tmp/', import.meta.url));
const database = `${tmp}e2e.db`;
const serverEntry = fileURLToPath(new URL('../../server/src/index.ts', import.meta.url));

// Start from nothing: remove the last run's database (and SQLite's side files).
mkdirSync(tmp, { recursive: true });
for (const suffix of ['', '-wal', '-shm']) rmSync(database + suffix, { force: true });

// `--import tsx` lets Node run the server's TypeScript directly, like `npm run dev`.
const server = spawn(process.execPath, ['--import', 'tsx', serverEntry], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'test',
    PORT: process.env.E2E_SERVER_PORT ?? '3101',
    DATABASE_PATH: database,
    DISCOGS_TOKEN: 'e2e-test-token',
    DISCOGS_API_URL: `http://localhost:${process.env.FAKE_DISCOGS_PORT ?? 3199}`,
  },
});

// When Playwright stops this script, stop the server too.
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.kill(signal));
server.on('exit', (code) => process.exit(code ?? 0));
