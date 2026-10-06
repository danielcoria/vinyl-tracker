import { Router } from 'express';
import { recordInputSchema, recordListQuerySchema, type RecordList } from '@vinyl/shared';
import { z } from 'zod';
import type { Db } from '../db/client.js';
import {
  createRecord,
  deleteRecord,
  getRecord,
  listRecords,
  updateRecord,
} from '../services/records.js';

const idParam = z.coerce.number().int().positive();

export function recordsRouter(db: Db) {
  const router = Router();

  router.get('/', (req, res) => {
    const query = recordListQuerySchema.parse(req.query);
    const body: RecordList = { records: listRecords(db, query) };
    res.json(body);
  });

  router.get('/:id', (req, res) => {
    res.json(getRecord(db, idParam.parse(req.params.id)));
  });

  router.post('/', (req, res) => {
    const record = createRecord(db, recordInputSchema.parse(req.body));
    res.status(201).location(`/api/records/${record.id}`).json(record);
  });

  router.put('/:id', (req, res) => {
    const id = idParam.parse(req.params.id);
    res.json(updateRecord(db, id, recordInputSchema.parse(req.body)));
  });

  router.delete('/:id', (req, res) => {
    deleteRecord(db, idParam.parse(req.params.id));
    res.status(204).end();
  });

  return router;
}
