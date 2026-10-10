// ============================================================================
// routes/dust.ts: THE ADDRESSES FOR THE DUST REPORT AND SETTINGS
//
//   GET /api/dust?days=90   records gathering dust and never played
//                           (leave out `days` to use the saved setting)
//   GET /api/settings       the app's settings
//   PUT /api/settings       change settings, e.g. { "dustThresholdDays": 60 }
// ============================================================================

import { Router } from 'express';
import { dustQuerySchema, settingsUpdateSchema } from '@vinyl/shared';
import type { Db } from '../db/client.js';
import { userIdOf } from '../middleware/session.js';
import { getDustReport } from '../services/dust.js';
import { getSettings, updateSettings } from '../services/settings.js';

export function dustRouter(db: Db) {
  const router = Router();
  router.get('/', (req, res) => {
    res.json(getDustReport(db, userIdOf(req), dustQuerySchema.parse(req.query)));
  });
  return router;
}

export function settingsRouter(db: Db) {
  const router = Router();
  router.get('/', (req, res) => {
    res.json(getSettings(db, userIdOf(req)));
  });
  router.put('/', (req, res) => {
    res.json(updateSettings(db, userIdOf(req), settingsUpdateSchema.parse(req.body)));
  });
  return router;
}
