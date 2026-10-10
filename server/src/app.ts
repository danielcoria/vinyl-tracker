// ============================================================================
// app.ts: BUILDS THE SERVER AND LISTS EVERY ADDRESS (URL) IT ANSWERS
//
// Express is the library that turns our code into a web server. You tell it
// "when someone asks for THIS address, run THIS function", and it does.
//
// A request passes through the `app.use(...)` / `app.get(...)` lines from top
// to bottom until one of them answers it.
//
// This file builds the server but doesn't start it (index.ts does that).
// Keeping them separate lets tests use the server without opening a real port.
//
// Online (production) it also: sends security headers, asks for the site
// password if one is set, and delivers the built website itself.
// ============================================================================

import express from 'express';
import helmet from 'helmet';
import type { HealthResponse } from '@vinyl/shared';
import type { Db } from './db/client.js';
import type { DiscogsClient } from './integrations/discogs/client.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { passwordLock } from './middleware/password-lock.js';
import { serveClient } from './middleware/serve-client.js';
import { discogsRouter } from './routes/discogs.js';
import { dustRouter, settingsRouter } from './routes/dust.js';
import { recordsRouter } from './routes/records.js';
import { spinsRouter } from './routes/spins.js';
import { statsRouter } from './routes/stats.js';
import { stylusesRouter } from './routes/styluses.js';

/**
 * What the server needs from outside to work. Tests pass in a temporary
 * database and a Discogs client that answers from recorded files.
 */
export type AppDeps = {
  db: Db;
  /** null when there's no Discogs token in .env. */
  discogs?: DiscogsClient | null;
  /** The site-wide password; null/undefined = no lock (local development). */
  password?: string | null;
  /** The built website (client/dist) to deliver; null = Vite delivers it (development). */
  clientDist?: string | null;
  /** True behind a host's proxy, so visitors' real addresses are used. */
  trustProxy?: boolean;
  /** True on the public demo (see db/demo.ts). */
  demo?: boolean;
};

export function createApp({
  db,
  discogs = null,
  password = null,
  clientDist = null,
  trustProxy = false,
  demo = false,
}: AppDeps) {
  const app = express();
  app.disable('x-powered-by'); // don't advertise "made with Express" (minor security habit)
  if (trustProxy) app.set('trust proxy', 1);

  // Security headers: tell browsers to only run our own code, only load images
  // from our site or https (covers come from Discogs), and never show the site
  // inside another site's frame.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          // React and the charts set small inline styles (e.g. bar widths).
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          // Off so the built app can also be tried on plain http://localhost.
          upgradeInsecureRequests: null,
        },
      },
    }),
  );
  app.use(express.json()); // read JSON data sent by the website into `req.body`

  // GET /api/health: a simple "are you alive?" check.
  // `req` = the incoming request, `res` = the response we send back.
  app.get('/api/health', (_req, res) => {
    const body: HealthResponse = { status: 'ok', uptimeSeconds: process.uptime(), demo };
    res.json(body);
  });

  // Everything below the health check needs the password (when one is set).
  // The health check stays open so a host can tell the app is running.
  if (password) app.use(passwordLock(password));

  // Every address starting with /api/records is handled in routes/records.ts.
  app.use('/api/records', recordsRouter(db));
  // The listening diary: routes/spins.ts.
  app.use('/api/spins', spinsRouter(db));
  // Totals and rankings for the Stats page: routes/stats.ts.
  app.use('/api/stats', statsRouter(db));
  // The dust report and app settings: routes/dust.ts.
  app.use('/api/dust', dustRouter(db));
  app.use('/api/settings', settingsRouter(db));
  // Stylus wear tracker: routes/styluses.ts.
  app.use('/api/styluses', stylusesRouter(db));
  // Searching and importing from Discogs: routes/discogs.ts.
  app.use('/api/discogs', discogsRouter(db, discogs));

  // Nothing above matched -> answer "404 Not Found".
  app.use('/api', notFoundHandler);
  // Online: every other address gets the website (see middleware/serve-client.ts).
  if (clientDist) app.use(serveClient(clientDist));
  // If anything above threw an error, turn it into a tidy error response.
  app.use(errorHandler);

  return app;
}
