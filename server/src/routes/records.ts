// ============================================================================
// routes/records.ts: THE ADDRESSES (URLs) FOR WORKING WITH RECORDS
//
// Each block below handles one kind of request. The method (GET, POST...) says
// what the website wants to do:
//   GET    /api/records       -> list records (optionally ?q=search&sort=artist)
//   GET    /api/records/5     -> get record number 5
//   GET    /api/records/5/tracks -> record 5's tracklist (songs and sides)
//   POST   /api/records       -> add a new record
//   PUT    /api/records/5     -> replace record 5 with new details
//   DELETE /api/records/5     -> delete record 5
//
// Routes stay short on purpose: check the input, call the "service" (which
// does the real work in services/records.ts), send back the result.
// ============================================================================

import { Router } from 'express';
import {
  recordInputSchema,
  recordListQuerySchema,
  type RecordList,
  type TrackList,
} from '@vinyl/shared';
import { z } from 'zod';
import type { Db } from '../db/client.js';
import {
  createRecord,
  deleteRecord,
  getRecord,
  listRecords,
  updateRecord,
} from '../services/records.js';
import { getTracks } from '../services/tracks.js';

// The `:id` part of the URL arrives as text ("5"). This turns it into a number
// and rejects anything that isn't a positive whole number (e.g. "abc").
const idParam = z.coerce.number().int().positive();

export function recordsRouter(db: Db) {
  const router = Router();

  // GET /api/records?q=...&sort=...
  router.get('/', (req, res) => {
    // `.parse` checks the input. If it's invalid it throws an error, and the
    // error handler answers "400 Bad Request". So bad input never reaches the database.
    const query = recordListQuerySchema.parse(req.query);
    const body: RecordList = { records: listRecords(db, query) };
    res.json(body);
  });

  // GET /api/records/:id
  router.get('/:id', (req, res) => {
    res.json(getRecord(db, idParam.parse(req.params.id)));
  });

  // GET /api/records/:id/tracks
  router.get('/:id/tracks', (req, res) => {
    const record = getRecord(db, idParam.parse(req.params.id)); // 404 if missing
    const body: TrackList = { tracks: getTracks(db, record.id) };
    res.json(body);
  });

  // POST /api/records: the new record's details are in req.body.
  router.post('/', (req, res) => {
    const record = createRecord(db, recordInputSchema.parse(req.body));
    // 201 means "Created". `location` tells the website where the new record lives.
    res.status(201).location(`/api/records/${record.id}`).json(record);
  });

  // PUT /api/records/:id
  router.put('/:id', (req, res) => {
    const id = idParam.parse(req.params.id);
    res.json(updateRecord(db, id, recordInputSchema.parse(req.body)));
  });

  // DELETE /api/records/:id: 204 means "done, nothing to send back".
  router.delete('/:id', (req, res) => {
    deleteRecord(db, idParam.parse(req.params.id));
    res.status(204).end();
  });

  return router;
}
