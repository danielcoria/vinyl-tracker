// ============================================================================
// stats.ts: WHAT THE STATS PAGE GETS FROM THE SERVER
//
//   statsQuerySchema   which period (from / to) and the viewer's time zone
//   statsSchema        totals, most-listened artists and records, and
//                      listening time per genre for each month
//
// Rankings are by listening TIME, not by number of plays: playing one side
// counts for less than playing the whole double album.
// ============================================================================

import { z } from 'zod';
import { spinRecordSchema } from './spins.js';

export const statsQuerySchema = z.object({
  /** Only plays that started at or after this time. */
  from: z.iso.datetime().optional(),
  /** Only plays that started before this time. */
  to: z.iso.datetime().optional(),
  /**
   * The viewer's time zone as minutes from UTC (e.g. -240 for New York in
   * summer), so a play at 11 PM local time counts in the right month.
   */
  utcOffsetMinutes: z.coerce.number().int().min(-840).max(840).default(0),
});

export type StatsQuery = z.input<typeof statsQuerySchema>;

const playTotals = {
  spinCount: z.number().int(),
  listeningSeconds: z.number().int(),
};

export const statsSchema = z.object({
  totals: z.object({
    ...playTotals,
    /** Different records played. */
    recordCount: z.number().int(),
    /** Different artists played. */
    artistCount: z.number().int(),
  }),
  /** Top 10, most listening time first. */
  topArtists: z.array(z.object({ id: z.number().int(), name: z.string(), ...playTotals })),
  /** Top 10, most listening time first. */
  topRecords: z.array(z.object({ record: spinRecordSchema, ...playTotals })),
  genresByMonth: z.object({
    /** Every month in the period, oldest first: "2026-09", "2026-10"... */
    months: z.array(z.string()),
    /**
     * The 5 most-listened genres, then "Other" if there are more.
     * `seconds[i]` is the listening time in `months[i]`.
     */
    genres: z.array(z.object({ name: z.string(), seconds: z.array(z.number().int()) })),
  }),
});

export type Stats = z.infer<typeof statsSchema>;
