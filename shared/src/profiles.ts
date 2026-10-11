// ============================================================================
// profiles.ts: WHAT A PUBLIC PROFILE PAGE GETS FROM THE SERVER
//
//   profileQuerySchema   the viewer's time zone (so plays land in the right year)
//   profileSchema        /u/username: who they are, their shelf, most-played
//                        records and artists, recent plays, and which years
//                        have a "year in records"
//   yearInRecordsSchema  /u/username/year/2026: a recap of one year
//
// Only things that are fine to share are here: ratings and reviews, but no
// notes, no record conditions, nothing about the stylus or settings.
// ============================================================================

import { z } from 'zod';
import { ratingSchema } from './ratings.js';
import { spinRecordSchema } from './spins.js';
import { statsSchema } from './stats.js';

export const profileQuerySchema = z.object({
  /** Minutes from UTC (e.g. -240 for New York in summer), as on the Stats page. */
  utcOffsetMinutes: z.coerce.number().int().min(-840).max(840).default(0),
});

export type ProfileQuery = z.input<typeof profileQuerySchema>;

export const yearParamSchema = z.coerce
  .number({ error: 'Pick a year' })
  .int('Pick a year')
  .min(1900, 'Pick a year from 1900')
  .max(2100, 'Pick a year up to 2100');

const profileUserSchema = z.object({
  username: z.string(),
  displayName: z.string(),
  memberSince: z.string(),
});

/** Who's looking: only the owner sees a private profile (as a preview). */
const viewerSchema = {
  isPublic: z.boolean(),
  isOwner: z.boolean(),
};

/** A record as shown on someone's shelf. */
export const shelfRecordSchema = spinRecordSchema.extend({
  year: z.number().int().nullable(),
  spinCount: z.number().int(),
  rating: ratingSchema.nullable(),
});

/** A record with the stars its owner gave it. */
const ratedRecordSchema = z.object({ record: spinRecordSchema, rating: ratingSchema });

export type ShelfRecord = z.infer<typeof shelfRecordSchema>;

export const profileSchema = z.object({
  user: profileUserSchema,
  ...viewerSchema,
  totals: z.object({
    recordCount: z.number().int(),
    spinCount: z.number().int(),
    listeningSeconds: z.number().int(),
  }),
  /** All time, top 10. */
  topRecords: statsSchema.shape.topRecords,
  /** All time, top 10. */
  topArtists: statsSchema.shape.topArtists,
  /** The latest plays, newest first (without their notes). */
  recentPlays: z.array(
    z.object({
      playedAt: z.string(),
      durationSeconds: z.number().int(),
      sides: z.array(z.string()).nullable(),
      /** How that listen went, if it was rated. */
      rating: ratingSchema.nullable(),
      record: spinRecordSchema,
    }),
  ),
  /** The best-rated records (up to 6), highest first. */
  highestRated: z.array(ratedRecordSchema),
  /** Written reviews, newest first (up to 10). */
  reviews: z.array(
    z.object({
      record: spinRecordSchema,
      rating: ratingSchema.nullable(),
      review: z.string(),
      reviewedAt: z.string(),
    }),
  ),
  /** Every record they own, sorted by artist. */
  shelf: z.array(shelfRecordSchema),
  /** Years with at least one play, newest first. */
  years: z.array(z.number().int()),
});

export type Profile = z.infer<typeof profileSchema>;

export const yearInRecordsSchema = z.object({
  user: profileUserSchema,
  ...viewerSchema,
  year: z.number().int(),
  totals: statsSchema.shape.totals,
  topRecords: statsSchema.shape.topRecords,
  topArtists: statsSchema.shape.topArtists,
  /** All 12 months, January first: "2026-01"... */
  months: z.array(z.object({ month: z.string(), listeningSeconds: z.number().int() })),
  /** The 5 most-listened genres, then "Other". */
  topGenres: z.array(z.object({ name: z.string(), listeningSeconds: z.number().int() })),
  /** Records added to the shelf during the year. */
  addedCount: z.number().int(),
  /** The best-rated record among those played during the year (null if none is rated). */
  highestRated: ratedRecordSchema.nullable(),
});

export type YearInRecords = z.infer<typeof yearInRecordsSchema>;
