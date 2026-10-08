// ============================================================================
// routes/discogs.ts: THE ADDRESSES FOR DISCOGS FEATURES
//
//   GET  /api/discogs/search?q=kind+of+blue&page=1  search Discogs for vinyl
//   POST /api/discogs/import  { releaseId }         add a release as a new record
//   POST /api/discogs/link    { recordId, releaseId } fill in a record from Discogs
//
// If the server has no Discogs token, these answer "503: not set up" with a
// message saying how to fix it, instead of failing in a confusing way.
// ============================================================================

import { Router } from 'express';
import {
  discogsImportInputSchema,
  discogsLinkInputSchema,
  discogsSearchQuerySchema,
} from '@vinyl/shared';
import type { Db } from '../db/client.js';
import { AppError } from '../errors.js';
import type { DiscogsClient } from '../integrations/discogs/client.js';
import { importRelease, linkRecord, searchDiscogs } from '../services/discogs.js';

export function discogsRouter(db: Db, discogs: DiscogsClient | null) {
  const router = Router();

  function client(): DiscogsClient {
    if (!discogs) {
      throw new AppError(
        503,
        'DISCOGS_NOT_CONFIGURED',
        'Discogs is not set up. Add DISCOGS_TOKEN to the .env file and restart the server.',
      );
    }
    return discogs;
  }

  // `async` handlers wait for Discogs to answer. If they throw, Express passes
  // the error to the error handler, just like the other routes.
  router.get('/search', async (req, res) => {
    const query = discogsSearchQuerySchema.parse(req.query);
    res.json(await searchDiscogs(db, client(), query));
  });

  router.post('/import', async (req, res) => {
    const { releaseId } = discogsImportInputSchema.parse(req.body);
    const record = await importRelease(db, client(), releaseId);
    res.status(201).location(`/api/records/${record.id}`).json(record);
  });

  router.post('/link', async (req, res) => {
    const input = discogsLinkInputSchema.parse(req.body);
    res.json(await linkRecord(db, client(), input));
  });

  return router;
}
