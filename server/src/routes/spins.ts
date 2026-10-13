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
import type { LastfmSource } from '../integrations/lastfm/client.js';
import { userIdOf } from '../middleware/session.js';
import { scrobbleSpin } from '../services/scrobbling.js';
import { createSpin, deleteSpin, listSpins } from '../services/spins.js';

const idParam = z.coerce.number().int().positive();

export function spinsRouter(db: Db, lastfm: LastfmSource | null = null) {
  const router = Router();

  router.get('/', (req, res) => {
    const body: SpinList = {
      spins: listSpins(db, userIdOf(req), spinListQuerySchema.parse(req.query)),
    };
    res.json(body);
  });

  router.post('/', async (req, res) => {
    const spin = createSpin(db, userIdOf(req), spinInputSchema.parse(req.body));
    // If it's meant for Last.fm and already over, send it straight away. A play
    // that is still going (or a busy Last.fm) stays 'pending' and is sent later
    // by the timer in index.ts. Scrobbling never makes logging a play fail.
    if (spin.scrobble === 'pending' && lastfm?.canScrobble) {
      spin.scrobble = await scrobbleSpin(db, lastfm, spin.id).catch(() => spin.scrobble);
    }
    res.status(201).json(spin);
  });

  router.delete('/:id', (req, res) => {
    deleteSpin(db, userIdOf(req), idParam.parse(req.params.id));
    res.status(204).end();
  });

  return router;
}
