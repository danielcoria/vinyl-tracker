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
import { LastfmClient } from './integrations/lastfm/client.js';
import { sampleLastfm } from './integrations/lastfm/sample.js';
import { REPO_ROOT } from './paths.js';
import { scrobbleDue } from './services/scrobbling.js';
import { snapshotPrices } from './services/value.js';

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
// Last.fm: the real thing when there's an API key. On the demo, the demo account
// always sees built-in sample albums (and so does everyone, without a key).
const realLastfm = config.lastfm.apiKey
  ? new LastfmClient({
      apiKey: config.lastfm.apiKey,
      sharedSecret: config.lastfm.sharedSecret,
      apiUrl: config.lastfm.apiUrl,
      authUrl: config.lastfm.authUrl,
      userAgent: config.discogs.userAgent,
    })
  : null;
const lastfm = config.demoMode ? sampleLastfm(realLastfm) : realLastfm;
const builtWebsite = path.join(REPO_ROOT, 'client', 'dist');
const clientDist =
  config.nodeEnv === 'production' && existsSync(path.join(builtWebsite, 'index.html'))
    ? builtWebsite
    : null;
const app = createApp({
  db,
  discogs,
  lastfm,
  password: config.appPassword,
  clientDist,
  trustProxy: config.trustProxy,
  demo: config.demoMode,
  // Online, the login cookie is only sent over HTTPS.
  secureCookies: config.nodeEnv === 'production',
}); // build the server with what it needs

// 3. Start listening on port 3001. The function inside runs once it's ready.
// Collection value: every 10 minutes, look up prices for a few records that
// haven't been priced in the last day. Small batches keep it far below Discogs'
// limit of 60 requests a minute, so it never gets in the way of people using
// the site. (Off during tests, and the demo account's made-up prices are skipped.)
const PRICE_CHECK_MINUTES = 10;
const PRICES_PER_CHECK = 15;
if (discogs && config.nodeEnv !== 'test') {
  const checkPrices = () =>
    snapshotPrices(db, discogs, { limit: PRICES_PER_CHECK, exceptUserId: demo?.userId }).catch(
      (error: unknown) => console.error('Price update failed:', error),
    );
  // unref(): this timer alone doesn't keep the server running when it's told to stop.
  setInterval(checkPrices, PRICE_CHECK_MINUTES * 60 * 1000).unref();
  // And once shortly after starting, so a fresh server doesn't wait 10 minutes.
  setTimeout(checkPrices, 30 * 1000).unref();
}

// Scrobbling: every 2 minutes, send plays that were waiting to finish ("I'm starting
// now") and have now ended. Off during tests.
const SCROBBLE_CHECK_MINUTES = 2;
if (lastfm?.canScrobble && config.nodeEnv !== 'test') {
  const sendDue = () =>
    scrobbleDue(db, lastfm).catch((error: unknown) => console.error('Scrobbling failed:', error));
  setInterval(sendDue, SCROBBLE_CHECK_MINUTES * 60 * 1000).unref();
}

app.listen(config.port, () => {
  console.log(`API listening on http://localhost:${config.port}`);
  console.log(`Database: ${config.databasePath}`);
  // Only say whether the token exists. Never print the token itself.
  console.log(`Discogs token: ${config.discogs.token ? 'configured' : 'missing'}`);
  console.log(`Last.fm: ${realLastfm ? 'configured' : lastfm ? 'sample data (demo)' : 'missing'}`);
  console.log(
    `Last.fm scrobbling: ${lastfm?.canScrobble ? 'configured' : 'off (no shared secret)'}`,
  );
  console.log(`Password lock: ${config.appPassword ? 'on' : 'off'}`);
  if (demo) console.log(`Demo mode: on (added ${demo.records} albums and ${demo.spins} plays)`);
  console.log(
    `Website: ${clientDist ? `served from ${clientDist}` : 'not served here (use npm run dev)'}`,
  );
});
