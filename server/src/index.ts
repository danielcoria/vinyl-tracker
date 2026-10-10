// ============================================================================
// index.ts: THE STARTING POINT OF THE SERVER
//
// `npm run dev` runs this file. It does three things, in order:
//   1. read the settings (port number, database location, Discogs token)
//   2. open the database
//   3. start listening for requests from the website
// After that the server just waits. That's why the terminal goes quiet.
// ============================================================================

import { existsSync } from 'node:fs';
import path from 'node:path';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createDb } from './db/client.js';
import { seedDemoData } from './db/demo.js';
import { DiscogsClient } from './integrations/discogs/client.js';
import { REPO_ROOT } from './paths.js';

const config = loadConfig(); // 1. settings from .env
const db = createDb(config.databasePath); // 2. open (or create) data/vinyl.db
// The public demo starts empty after every restart, so fill it with sample data.
const demo = config.demoMode ? seedDemoData(db) : null;
// The Discogs connection, if there's a token. Without one, Discogs features say "not set up".
const discogs = config.discogs.token
  ? new DiscogsClient({
      token: config.discogs.token,
      userAgent: config.discogs.userAgent,
      apiUrl: config.discogs.apiUrl,
    })
  : null;
// In production the server also delivers the built website (npm run build).
const builtWebsite = path.join(REPO_ROOT, 'client', 'dist');
const clientDist =
  config.nodeEnv === 'production' && existsSync(path.join(builtWebsite, 'index.html'))
    ? builtWebsite
    : null;
const app = createApp({
  db,
  discogs,
  password: config.appPassword,
  clientDist,
  trustProxy: config.trustProxy,
  demo: config.demoMode,
}); // build the server with what it needs

// 3. Start listening on port 3001. The function inside runs once it's ready.
app.listen(config.port, () => {
  console.log(`API listening on http://localhost:${config.port}`);
  console.log(`Database: ${config.databasePath}`);
  // Only say whether the token exists. Never print the token itself.
  console.log(`Discogs token: ${config.discogs.token ? 'configured' : 'missing'}`);
  console.log(`Password lock: ${config.appPassword ? 'on' : 'off'}`);
  if (demo) console.log(`Demo mode: on (added ${demo.records} albums and ${demo.spins} plays)`);
  console.log(
    `Website: ${clientDist ? `served from ${clientDist}` : 'not served here (use npm run dev)'}`,
  );
});
