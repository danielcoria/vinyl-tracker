// ============================================================================
// discogs.ts: WHAT DISCOGS SEARCH AND IMPORT LOOK LIKE
//
// The website never talks to Discogs directly (the token stays on the server).
// It asks our server, which asks Discogs and answers in these simpler shapes:
//   discogsSearchQuerySchema     what to search for (?q=...&page=...)
//   discogsSearchResultSchema    one release in the search results
//   discogsSearchResponseSchema  a page of results
//   discogsImportInputSchema     "add this release to my collection"
//   discogsLinkInputSchema       "this record I already have is that release"
// ============================================================================

import { z } from 'zod';

export const discogsSearchQuerySchema = z.object({
  q: z.string().trim().min(1, 'Type something to search for').max(200),
  page: z.coerce.number().int().min(1).max(100).default(1),
});

export type DiscogsSearchQuery = z.input<typeof discogsSearchQuerySchema>;

export const discogsSearchResultSchema = z.object({
  releaseId: z.number().int(),
  title: z.string(),
  artist: z.string(),
  year: z.number().int().nullable(),
  format: z.string().nullable(),
  label: z.string().nullable(),
  catalogNumber: z.string().nullable(),
  country: z.string().nullable(),
  thumbUrl: z.string().nullable(),
  /** The id of the record in the collection if this release was already imported. */
  inCollectionId: z.number().int().nullable(),
});

export type DiscogsSearchResult = z.infer<typeof discogsSearchResultSchema>;

export const discogsSearchResponseSchema = z.object({
  results: z.array(discogsSearchResultSchema),
  page: z.number().int(),
  pages: z.number().int(),
});

export type DiscogsSearchResponse = z.infer<typeof discogsSearchResponseSchema>;

export const discogsImportInputSchema = z.object({
  releaseId: z.number().int().positive(),
});

export const discogsLinkInputSchema = z.object({
  recordId: z.number().int().positive(),
  releaseId: z.number().int().positive(),
});

export type DiscogsLinkInput = z.infer<typeof discogsLinkInputSchema>;
