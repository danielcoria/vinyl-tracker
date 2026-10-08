// ============================================================================
// dust.ts: WHAT THE DUST REPORT LOOKS LIKE
//
// The dust report lists records you own but aren't playing:
//   dusty         played before, but not in the last `thresholdDays` days
//                 (oldest last play first)
//   neverPlayed   never played since you added them (longest-owned first)
// ============================================================================

import { z } from 'zod';
import { spinRecordSchema } from './spins.js';

export const dustQuerySchema = z.object({
  /** Override the saved threshold for this request (in days). */
  days: z.coerce.number().int().min(1).max(3650).optional(),
});

export type DustQuery = z.input<typeof dustQuerySchema>;

export const dustRecordSchema = z.object({
  record: spinRecordSchema,
  addedAt: z.string(),
  lastPlayedAt: z.string().nullable(),
  spinCount: z.number().int(),
  /** Whole days since the last play, or since it was added if never played. */
  days: z.number().int(),
});

export type DustRecord = z.infer<typeof dustRecordSchema>;

export const dustReportSchema = z.object({
  thresholdDays: z.number().int(),
  /** How many records are in the collection in total. */
  collectionCount: z.number().int(),
  dusty: z.array(dustRecordSchema),
  neverPlayed: z.array(dustRecordSchema),
});

export type DustReport = z.infer<typeof dustReportSchema>;
