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
// ============================================================================

import express from 'express';
import type { HealthResponse } from '@vinyl/shared';
import type { Db } from './db/client.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { recordsRouter } from './routes/records.js';

/** What the server needs from outside to work. Tests pass in a temporary database. */
export type AppDeps = { db: Db };

export function createApp({ db }: AppDeps) {
  const app = express();
  app.disable('x-powered-by'); // don't advertise "made with Express" (minor security habit)
  app.use(express.json()); // read JSON data sent by the website into `req.body`

  // GET /api/health: a simple "are you alive?" check.
  // `req` = the incoming request, `res` = the response we send back.
  app.get('/api/health', (_req, res) => {
    const body: HealthResponse = { status: 'ok', uptimeSeconds: process.uptime() };
    res.json(body);
  });

  // Every address starting with /api/records is handled in routes/records.ts.
  app.use('/api/records', recordsRouter(db));

  // Nothing above matched -> answer "404 Not Found".
  app.use('/api', notFoundHandler);
  // If anything above threw an error, turn it into a tidy error response.
  app.use(errorHandler);

  return app;
}
