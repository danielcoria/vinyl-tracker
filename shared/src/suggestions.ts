// ============================================================================
// suggestions.ts: "WHAT SHOULD I PLAY TONIGHT?"
//
//   suggestionQuerySchema   what the person asked for: how much time they
//                           have, a genre, a mood, and records to skip
//   suggestionsSchema       up to three picks from their own shelf, plus what's
//                           needed to explain each pick
//
// The server only sends facts (which sides fit, when it was last played, its
// rating); the website turns them into sentences.
// ============================================================================

import { z } from 'zod';
import { ratingSchema } from './ratings.js';
import { spinRecordSchema } from './spins.js';

/** "any" = a balance; "favorites" = best rated first; "neglected" = longest unplayed first. */
export const SUGGESTION_MOODS = ['any', 'favorites', 'neglected'] as const;
export type SuggestionMood = (typeof SUGGESTION_MOODS)[number];

export const SUGGESTION_COUNT = 3;

export const suggestionQuerySchema = z.object({
  /** Time available, in minutes. Left out = no limit. */
  minutes: z.coerce
    .number({ error: 'Time must be a number of minutes' })
    .int('Time must be a whole number of minutes')
    .min(5, 'Pick at least 5 minutes')
    .max(600, 'Pick at most 10 hours')
    .optional(),
  /** Only records with this genre (capital letters don't matter). */
  genre: z.string().trim().min(1).max(100).optional(),
  mood: z.enum(SUGGESTION_MOODS).default('any'),
  /** Record ids to leave out, comma-separated: "3,8,12" (used by Shuffle). */
  exclude: z
    .string()
    .regex(/^\d+(,\d+)*$/, 'exclude is a list of record numbers, like 3,8,12')
    .optional()
    .transform((ids) => (ids ? ids.split(',').map(Number) : [])),
});

export type SuggestionQuery = z.input<typeof suggestionQuerySchema>;
export type ParsedSuggestionQuery = z.output<typeof suggestionQuerySchema>;

export const suggestionSchema = z.object({
  record: spinRecordSchema,
  year: z.number().int().nullable(),
  genres: z.array(z.string()),
  rating: ratingSchema.nullable(),
  spinCount: z.number().int(),
  lastPlayedAt: z.string().nullable(),
  /** Days since the last play, or since it was added if never played. */
  daysSince: z.number().int(),
  /** What to put on: null = the whole record, or the sides that fit the time. */
  sides: z.array(z.string()).nullable(),
  /** How long that takes (null if the record has no known length). */
  durationSeconds: z.number().int().nullable(),
});

export type Suggestion = z.infer<typeof suggestionSchema>;

export const suggestionsSchema = z.object({
  suggestions: z.array(suggestionSchema),
  /** How many records fit the time and genre asked for (before picking three). */
  matchCount: z.number().int(),
  /** Every genre in the collection, most common first, for the genre picker. */
  genres: z.array(z.string()),
});

export type Suggestions = z.infer<typeof suggestionsSchema>;
