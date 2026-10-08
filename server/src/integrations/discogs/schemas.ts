// ============================================================================
// schemas.ts: WHAT DISCOGS SENDS BACK
//
// Discogs' answers are big and we only need some fields. These schemas list
// the fields we use, so anything unexpected (a missing field, a wrong type) is
// caught right away instead of breaking something later. Fields we don't list
// are ignored. Most are optional because Discogs data is entered by its
// community and is often incomplete.
// ============================================================================

import { z } from 'zod';

// ---------- GET /database/search ----------

const rawSearchResultSchema = z.object({
  id: z.number().int(),
  title: z.string(), // "Artist - Title"
  year: z.union([z.string(), z.number()]).optional(),
  country: z.string().optional(),
  format: z.array(z.string()).optional(), // e.g. ["Vinyl", "LP", "Album"]
  label: z.array(z.string()).optional(),
  catno: z.string().optional(),
  thumb: z.string().optional(),
  cover_image: z.string().optional(),
});

export const rawSearchSchema = z.object({
  pagination: z.object({ page: z.number().int(), pages: z.number().int() }),
  results: z.array(rawSearchResultSchema),
});

export type RawSearch = z.infer<typeof rawSearchSchema>;
export type RawSearchResult = z.infer<typeof rawSearchResultSchema>;

// ---------- GET /releases/:id ----------

const rawTrackFields = {
  position: z.string().optional(),
  type_: z.string().optional(), // "track", "heading" (a section title) or "index" (a medley)
  title: z.string().optional(),
  duration: z.string().optional(), // "8:56", or "" when unknown
};

const rawTrackSchema = z.object({
  ...rawTrackFields,
  sub_tracks: z.array(z.object(rawTrackFields)).optional(),
});

export const rawReleaseSchema = z.object({
  id: z.number().int(),
  title: z.string(),
  year: z.number().int().optional(), // 0 when unknown
  country: z.string().optional(),
  artists: z.array(z.object({ id: z.number().int(), name: z.string() })).default([]),
  labels: z.array(z.object({ name: z.string(), catno: z.string().optional() })).default([]),
  formats: z
    .array(
      z.object({
        name: z.string(), // "Vinyl"
        qty: z.string().optional(), // "2" for a double album
        descriptions: z.array(z.string()).optional(), // ["LP", "Album", ...]
      }),
    )
    .default([]),
  genres: z.array(z.string()).default([]),
  styles: z.array(z.string()).default([]),
  tracklist: z.array(rawTrackSchema).default([]),
  images: z.array(z.object({ type: z.string(), uri: z.string() })).default([]),
});

export type RawRelease = z.infer<typeof rawReleaseSchema>;
export type RawTrack = z.infer<typeof rawTrackSchema>;
