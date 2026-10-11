// ============================================================================
// routes/profiles.ts: THE ADDRESSES FOR PUBLIC PROFILES (no login needed)
//
//   GET /api/profiles/:username?utcOffsetMinutes=-240
//     the profile page: shelf, most-played, recent plays, years
//   GET /api/profiles/:username/years/:year?utcOffsetMinutes=-240
//     one year's recap ("year in records")
//
// Both answer 404 PROFILE_NOT_FOUND when the profile is private (unless the
// owner is the one asking) or doesn't exist.
// ============================================================================

import { Router } from 'express';
import { profileQuerySchema, yearParamSchema } from '@vinyl/shared';
import type { Db } from '../db/client.js';
import { getProfile, getYearInRecords } from '../services/profiles.js';

export function profilesRouter(db: Db) {
  const router = Router();

  router.get('/:username', (req, res) => {
    const query = profileQuerySchema.parse(req.query);
    res.json(getProfile(db, req.params.username, req.user, query));
  });

  router.get('/:username/years/:year', (req, res) => {
    const query = profileQuerySchema.parse(req.query);
    const year = yearParamSchema.parse(req.params.year);
    res.json(getYearInRecords(db, req.params.username, year, req.user, query));
  });

  return router;
}
