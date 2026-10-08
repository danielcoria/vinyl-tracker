// ============================================================================
// spins.ts: WHAT TRACKS AND PLAYS ("SPINS") LOOK LIKE
//
//   trackSchema      one song on a record: its position (A1), side (A),
//                    title and length
//   spinInputSchema  what the website sends to log a play
//   spinSchema       a logged play, as the server sends it back (with a
//                    short summary of the record, for the diary page)
//
// A "spin" is one entry in the listening diary: you played some sides of a
// record, starting at a certain time, for a certain length.
// ============================================================================

import { z } from 'zod';
import { artistCreditSchema } from './records.js';

export const trackSchema = z.object({
  id: z.number().int(),
  position: z.string(), // "A1", "B2"... ("" if Discogs has none)
  side: z.string().nullable(), // "A", "B"... (null if the position has no side letter)
  title: z.string(),
  durationSeconds: z.number().int().nullable(),
});

export type Track = z.infer<typeof trackSchema>;

export const trackListSchema = z.object({ tracks: z.array(trackSchema) });
export type TrackList = z.infer<typeof trackListSchema>;

/** A few minutes of leeway for clocks that are slightly ahead. */
const FUTURE_LEEWAY_MS = 5 * 60 * 1000;

export const spinInputSchema = z.object({
  recordId: z.number().int().positive(),
  /** When the play started. Defaults to now. */
  playedAt: z.iso
    .datetime({ error: 'Pick a valid date and time' })
    .refine((value) => Date.parse(value) <= Date.now() + FUTURE_LEEWAY_MS, {
      error: "The play can't start in the future",
    })
    .refine((value) => Date.parse(value) >= Date.parse('1900-01-01T00:00:00Z'), {
      error: 'Pick a date after 1900',
    })
    .default(() => new Date().toISOString()),
  /** Which sides were played, e.g. ["A", "B"]. null = the whole record. */
  sides: z
    .array(
      z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z]{1,2}$/, 'Sides are letters, like A or B'),
    )
    .min(1, 'Pick at least one side')
    .max(26)
    .nullish()
    .transform((sides) => (sides ? [...new Set(sides)] : null)),
  durationSeconds: z
    .number({ error: 'Enter how long you played' })
    .int()
    .positive('Length must be more than zero')
    .max(24 * 60 * 60, 'Length must be under 24 hours'),
  notes: z
    .string()
    .trim()
    .max(1000, 'Keep notes under 1000 characters')
    .nullish()
    .transform((value) => value || null),
});

export type SpinInput = z.input<typeof spinInputSchema>;
export type ParsedSpinInput = z.output<typeof spinInputSchema>;

/** Just enough about the record to show it in the diary. */
export const spinRecordSchema = z.object({
  id: z.number().int(),
  title: z.string(),
  artists: z.array(artistCreditSchema),
  coverImageUrl: z.string().nullable(),
});

export const spinSchema = z.object({
  id: z.number().int(),
  playedAt: z.string(),
  durationSeconds: z.number().int(),
  sides: z.array(z.string()).nullable(),
  notes: z.string().nullable(),
  record: spinRecordSchema,
});

export type Spin = z.infer<typeof spinSchema>;

export const spinListQuerySchema = z.object({
  /** Only plays of this record. */
  recordId: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export type SpinListQuery = z.input<typeof spinListQuerySchema>;

export const spinListSchema = z.object({ spins: z.array(spinSchema) });
export type SpinList = z.infer<typeof spinListSchema>;
