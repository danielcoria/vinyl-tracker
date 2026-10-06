import express from 'express';
import type { HealthResponse } from '@vinyl/shared';
import type { Db } from './db/client.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { recordsRouter } from './routes/records.js';

export type AppDeps = { db: Db };

/** Builds the Express app without listening, so tests can use it directly. */
export function createApp({ db }: AppDeps) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    const body: HealthResponse = { status: 'ok', uptimeSeconds: process.uptime() };
    res.json(body);
  });
  app.use('/api/records', recordsRouter(db));

  app.use('/api', notFoundHandler);
  app.use(errorHandler);

  return app;
}
