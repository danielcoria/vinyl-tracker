// ============================================================================
// routes/spins.ts: THE ADDRESSES FOR THE LISTENING DIARY
//
//   GET    /api/spins?recordId=5&limit=50  the diary, newest first
//   POST   /api/spins  { recordId, sides, playedAt, durationSeconds, notes }
//                       log a play
//   DELETE /api/spins/7                    remove a play logged by mistake
// ============================================================================

import { Router } from 'express';
import { spinInputSchema, spinListQuerySchema, type SpinList } from '@vinyl/shared';
import { z } from 'zod';
import type { Db } from '../db/client.js';
import { createSpin, deleteSpin, listSpins } from '../services/spins.js';

const idParam = z.coerce.number().int().positive();

export function spinsRouter(db: Db) {
  const router = Router();

  router.get('/', (req, res) => {
    const body: SpinList = { spins: listSpins(db, spinListQuerySchema.parse(req.query)) };
    res.json(body);
  });

  router.post('/', (req, res) => {
    res.status(201).json(createSpin(db, spinInputSchema.parse(req.body)));
  });

  router.delete('/:id', (req, res) => {
    deleteSpin(db, idParam.parse(req.params.id));
    res.status(204).end();
  });

  return router;
}
