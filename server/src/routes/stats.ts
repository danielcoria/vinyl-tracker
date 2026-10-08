// ============================================================================
// routes/stats.ts: THE ADDRESS FOR THE STATS PAGE
//
//   GET /api/stats?from=...&to=...&utcOffsetMinutes=-240
//     totals, top artists, top records and genres by month for that period
//     (leave out from/to for all time)
// ============================================================================

import { Router } from 'express';
import { statsQuerySchema } from '@vinyl/shared';
import type { Db } from '../db/client.js';
import { getStats } from '../services/stats.js';

export function statsRouter(db: Db) {
  const router = Router();

  router.get('/', (req, res) => {
    res.json(getStats(db, statsQuerySchema.parse(req.query)));
  });

  return router;
}
