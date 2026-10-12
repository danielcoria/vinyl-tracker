// ============================================================================
// routes/value.ts: THE ADDRESSES FOR THE COLLECTION'S VALUE
//
//   GET  /api/value           the total, how it moved, the chart's points,
//                             and each record's price
//   POST /api/value/refresh   look up prices that are due, now (a few at a time)
//
// Prices come from Discogs, so refreshing needs the Discogs token. The demo
// account's prices are made up (see db/demo.ts) and are never refreshed.
// ============================================================================

import { Router } from 'express';
import type { PriceRefresh } from '@vinyl/shared';
import type { Db } from '../db/client.js';
import { DEMO_USERNAME } from '../db/demo.js';
import { AppError } from '../errors.js';
import type { DiscogsClient } from '../integrations/discogs/client.js';
import { userIdOf } from '../middleware/session.js';
import { getCollectionValue, snapshotPrices } from '../services/value.js';

/** How many records one press of "Update prices now" looks up. */
const REFRESH_LIMIT = 20;

type Options = { discogs: DiscogsClient | null; demo: boolean };

export function valueRouter(db: Db, { discogs, demo }: Options) {
  const router = Router();
  // On the demo site, the shared demo account shows sample prices.
  const isSample = (username: string | undefined) => demo && username === DEMO_USERNAME;

  router.get('/', (req, res) => {
    const sample = isSample(req.user?.username);
    res.json(getCollectionValue(db, userIdOf(req), { sample }));
  });

  router.post('/refresh', async (req, res) => {
    const userId = userIdOf(req);
    if (isSample(req.user?.username)) {
      // Real prices would clash with the made-up history, so nothing is looked up.
      const body: PriceRefresh = { updated: 0, remaining: 0 };
      res.json(body);
      return;
    }
    if (!discogs) {
      throw new AppError(
        503,
        'DISCOGS_NOT_CONFIGURED',
        'Discogs is not set up. Add DISCOGS_TOKEN to the .env file and restart the server.',
      );
    }
    res.json(await snapshotPrices(db, discogs, { userId, limit: REFRESH_LIMIT }));
  });

  return router;
}
