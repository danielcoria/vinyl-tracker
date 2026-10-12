// ============================================================================
// routes/suggestions.ts: THE ADDRESS FOR "WHAT SHOULD I PLAY TONIGHT?"
//
//   GET /api/suggestions?minutes=45&genre=Jazz&mood=neglected&exclude=3,8
//     up to three records from your shelf that fit (every part is optional)
// ============================================================================

import { Router } from 'express';
import { suggestionQuerySchema } from '@vinyl/shared';
import type { Db } from '../db/client.js';
import { userIdOf } from '../middleware/session.js';
import { getSuggestions } from '../services/suggestions.js';

export function suggestionsRouter(db: Db) {
  const router = Router();

  router.get('/', (req, res) => {
    res.json(getSuggestions(db, userIdOf(req), suggestionQuerySchema.parse(req.query)));
  });

  return router;
}
