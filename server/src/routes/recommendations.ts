// ============================================================================
// routes/recommendations.ts: THE ADDRESS FOR RECOMMENDATIONS
//
//   GET /api/recommendations
//     albums by artists similar to the ones on your shelf, with the reasons
//
// Needs a Last.fm API key on the server (it's Last.fm that knows which artists
// are alike); without one it answers 503 "not set up".
// ============================================================================

import { Router } from 'express';
import type { Db } from '../db/client.js';
import { AppError } from '../errors.js';
import type { LastfmSource } from '../integrations/lastfm/client.js';
import { userIdOf } from '../middleware/session.js';
import { getRecommendations } from '../services/recommendations.js';

export function recommendationsRouter(db: Db, lastfm: LastfmSource | null) {
  const router = Router();

  router.get('/', async (req, res) => {
    const userId = userIdOf(req);
    if (!lastfm) {
      throw new AppError(
        503,
        'LASTFM_NOT_CONFIGURED',
        'Last.fm is not set up. Add LASTFM_API_KEY to the .env file and restart the server.',
      );
    }
    res.json(await getRecommendations(db, userId, lastfm));
  });

  return router;
}
