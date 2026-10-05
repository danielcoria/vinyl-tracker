import express from 'express';
import type { HealthResponse } from '@vinyl/shared';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';

/** Builds the Express app without listening, so tests can use it directly. */
export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    const body: HealthResponse = { status: 'ok', uptimeSeconds: process.uptime() };
    res.json(body);
  });

  app.use('/api', notFoundHandler);
  app.use(errorHandler);

  return app;
}
