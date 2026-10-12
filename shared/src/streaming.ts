// ============================================================================
// streaming.ts: STREAMING VS. SHELF, PRICES AND THE WISHLIST
//
//   streamingQuerySchema   which period of Last.fm listening to look at
//   streamingSchema        the most-streamed albums, each marked as on the
//                          shelf, on the wishlist, or neither
//   priceQuerySchema /     ask Discogs what an album costs on vinyl right now
//   vinylPriceSchema
//   wishlistInputSchema /  albums to buy one day
//   wishlistItemSchema
//
// Last.fm knows what was streamed; this app knows what's on the shelf. Put
// together: "streamed 214 times, not on your shelf, about $28 on vinyl".
// ============================================================================

import { z } from 'zod';

/** Last.fm's own names for its periods. */
export const STREAMING_PERIODS = ['overall', '12month', '6month', '3month', '1month'] as const;
export type StreamingPeriod = (typeof STREAMING_PERIODS)[number];

export const streamingQuerySchema = z.object({
  period: z.enum(STREAMING_PERIODS).default('12month'),
});

export type StreamingQuery = z.input<typeof streamingQuerySchema>;

/** Last.fm usernames: 2 to 15 letters, numbers, _ or -, starting with a letter. */
export const lastfmUsernameSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z][A-Za-z0-9_-]{1,14}$/, 'Enter a Last.fm username (2 to 15 letters or numbers)');

export const streamedAlbumSchema = z.object({
  /** 1 = the most streamed. */
  rank: z.number().int(),
  title: z.string(),
  artist: z.string(),
  playCount: z.number().int(),
  coverImageUrl: z.string().nullable(),
  lastfmUrl: z.string().nullable(),
  /** The record's id if it's on the shelf, otherwise null. */
  ownedRecordId: z.number().int().nullable(),
  /** The wishlist item's id if it's on the wishlist, otherwise null. */
  wishlistItemId: z.number().int().nullable(),
});

export type StreamedAlbum = z.infer<typeof streamedAlbumSchema>;

export const streamingSchema = z.object({
  username: z.string(),
  period: z.enum(STREAMING_PERIODS),
  /** Most streamed first (up to 50). */
  albums: z.array(streamedAlbumSchema),
  /** True when this is built-in sample data (the public demo), not a real account. */
  sample: z.boolean(),
});

export type Streaming = z.infer<typeof streamingSchema>;

const albumName = (what: string) =>
  z.string().trim().min(1, `${what} is required`).max(300, `Keep the ${what} under 300 characters`);

export const priceQuerySchema = z.object({
  artist: albumName('artist'),
  title: albumName('title'),
});

export type PriceQuery = z.input<typeof priceQuerySchema>;

/** The cheapest copy for sale on Discogs right now, for the closest vinyl pressing found. */
export const vinylPriceSchema = z.object({
  /** False when Discogs has no vinyl pressing that matches. */
  found: z.boolean(),
  releaseId: z.number().int().nullable(),
  /** What Discogs calls the pressing, e.g. "Radiohead - In Rainbows". */
  releaseTitle: z.string().nullable(),
  /** null when no copies are for sale. */
  lowestPrice: z.number().nullable(),
  /** e.g. "USD". */
  currency: z.string().nullable(),
  numForSale: z.number().int(),
});

export type VinylPrice = z.infer<typeof vinylPriceSchema>;

/** Body for POST /api/wishlist. */
export const wishlistInputSchema = z.object({
  title: albumName('title'),
  artist: albumName('artist'),
  coverImageUrl: z
    .string()
    .trim()
    .refine(
      (value) => URL.canParse(value) && /^https?:\/\//.test(value),
      'Enter a full web address',
    )
    .nullish()
    .transform((value) => value || null),
  /** How many times it was streamed when it was added (shown as the reason). */
  playCount: z
    .number()
    .int()
    .min(0)
    .nullish()
    .transform((value) => value ?? null),
});

export type WishlistInput = z.input<typeof wishlistInputSchema>;
export type ParsedWishlistInput = z.output<typeof wishlistInputSchema>;

export const wishlistItemSchema = z.object({
  id: z.number().int(),
  title: z.string(),
  artist: z.string(),
  coverImageUrl: z.string().nullable(),
  playCount: z.number().int().nullable(),
  addedAt: z.string(),
});

export type WishlistItem = z.infer<typeof wishlistItemSchema>;

export const wishlistSchema = z.object({ items: z.array(wishlistItemSchema) });
export type Wishlist = z.infer<typeof wishlistSchema>;
