// ============================================================================
// records.ts: WHAT A RECORD LOOKS LIKE (the most important contract)
//
// This file describes:
//   - recordInputSchema: what the website must send to add or edit a record,
//     with rules (title required, year between 1900 and next year, etc.)
//     and clean-up (trim spaces, turn empty text into null, drop duplicate tags)
//   - recordSchema: what a record looks like when the server sends it back
//   - recordListQuerySchema: the search/sort options for the record list
// The server uses these to reject bad input; the website will use them for forms.
// ============================================================================

import { z } from 'zod';

/** Goldmine grading, the standard scale collectors and Discogs use. */
export const CONDITION_GRADES = ['M', 'NM', 'VG+', 'VG', 'G+', 'G', 'F', 'P'] as const;
export const conditionSchema = z.enum(CONDITION_GRADES);
export type Condition = z.infer<typeof conditionSchema>;

/** Optional free text: trimmed, and blank becomes null (forms send ''). */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters`)
    .nullish()
    .transform((value) => value || null);

const tagList = z
  .array(z.string().trim().min(1).max(100, 'Keep each tag under 100 characters'))
  .max(30, 'Use 30 tags or fewer')
  .default([])
  // Drop case-insensitive duplicates, keeping the first spelling.
  .transform((tags) =>
    tags.filter((tag, i) => tags.findIndex((t) => t.toLowerCase() === tag.toLowerCase()) === i),
  );

// The messages below are shown to people in the add/edit form, so they're
// written in plain words rather than Zod's technical defaults.

/** Body for POST /api/records and PUT /api/records/:id (full replace). */
export const recordInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Title is required')
    .max(300, 'Keep the title under 300 characters'),
  /** Artist names in credit order. */
  artists: z
    .array(z.string().trim().min(1, 'Artist name is required').max(200))
    .min(1, 'At least one artist is required')
    .max(10, 'Use 10 artists or fewer'),
  year: z
    .number({ error: 'Year must be a number' })
    .int('Year must be a whole number')
    .min(1900, 'Year must be 1900 or later')
    .max(new Date().getFullYear() + 1, "Year can't be in the future")
    .nullish()
    .transform((value) => value ?? null),
  label: optionalText(200),
  catalogNumber: optionalText(100),
  /** Free text as printed on Discogs, e.g. "LP", "2xLP", '7"'. */
  format: optionalText(100),
  // Blank is allowed (no cover); anything else must be a full http(s) address.
  coverImageUrl: z
    .string()
    .trim()
    .refine(
      (value) => value === '' || (URL.canParse(value) && /^https?:\/\//.test(value)),
      'Enter a full web address, starting with https://',
    )
    .nullish()
    .transform((value) => value || null),
  /** Total play time, used as the default length when logging a spin. */
  runtimeSeconds: z
    .number()
    .int()
    .positive('Length must be more than zero')
    .max(24 * 60 * 60, 'Length must be under 24 hours')
    .nullish()
    .transform((value) => value ?? null),
  mediaCondition: conditionSchema.nullish().transform((value) => value ?? null),
  sleeveCondition: conditionSchema.nullish().transform((value) => value ?? null),
  notes: optionalText(2000),
  genres: tagList,
  styles: tagList,
});

/** What the client sends (before defaults and transforms). */
export type RecordInput = z.input<typeof recordInputSchema>;
/** What the server works with after validation. */
export type ParsedRecordInput = z.output<typeof recordInputSchema>;

export const artistCreditSchema = z.object({
  id: z.number().int(),
  name: z.string(),
});

export const recordSchema = z.object({
  id: z.number().int(),
  discogsReleaseId: z.number().int().nullable(),
  title: z.string(),
  artists: z.array(artistCreditSchema),
  year: z.number().int().nullable(),
  label: z.string().nullable(),
  catalogNumber: z.string().nullable(),
  format: z.string().nullable(),
  coverImageUrl: z.string().nullable(),
  runtimeSeconds: z.number().int().nullable(),
  mediaCondition: conditionSchema.nullable(),
  sleeveCondition: conditionSchema.nullable(),
  notes: z.string().nullable(),
  genres: z.array(z.string()),
  styles: z.array(z.string()),
  addedAt: z.string(),
  updatedAt: z.string(),
});

export type VinylRecord = z.infer<typeof recordSchema>;

export const RECORD_SORTS = ['added', 'artist', 'title', 'year'] as const;

/** Query string for GET /api/records. */
export const recordListQuerySchema = z.object({
  /** Case-insensitive match on title or any artist name. */
  q: z.string().trim().max(200).optional(),
  sort: z.enum(RECORD_SORTS).default('added'),
});

export type RecordListQuery = z.input<typeof recordListQuerySchema>;
export type ParsedRecordListQuery = z.output<typeof recordListQuerySchema>;

export const recordListSchema = z.object({
  records: z.array(recordSchema),
});

export type RecordList = z.infer<typeof recordListSchema>;
