// ============================================================================
// routes/styluses.ts: THE ADDRESSES FOR THE STYLUS WEAR TRACKER
//
//   GET    /api/styluses     every stylus with its wear (the one in use first)
//   POST   /api/styluses     install a new one { name, ratedHours, initialHours?, installedAt? }
//   PUT    /api/styluses/3   change name, rated hours or starting hours
//   DELETE /api/styluses/3   remove one added by mistake
// ============================================================================

import { Router } from 'express';
import { stylusInputSchema, stylusUpdateSchema, type StylusList } from '@vinyl/shared';
import { z } from 'zod';
import type { Db } from '../db/client.js';
import { userIdOf } from '../middleware/session.js';
import { addStylus, deleteStylus, listStyluses, updateStylus } from '../services/styluses.js';

const idParam = z.coerce.number().int().positive();

export function stylusesRouter(db: Db) {
  const router = Router();

  router.get('/', (req, res) => {
    const body: StylusList = { styluses: listStyluses(db, userIdOf(req)) };
    res.json(body);
  });

  router.post('/', (req, res) => {
    res.status(201).json(addStylus(db, userIdOf(req), stylusInputSchema.parse(req.body)));
  });

  router.put('/:id', (req, res) => {
    res.json(
      updateStylus(
        db,
        userIdOf(req),
        idParam.parse(req.params.id),
        stylusUpdateSchema.parse(req.body),
      ),
    );
  });

  router.delete('/:id', (req, res) => {
    deleteStylus(db, userIdOf(req), idParam.parse(req.params.id));
    res.status(204).end();
  });

  return router;
}
