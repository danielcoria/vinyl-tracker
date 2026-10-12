// ============================================================================
// recommendations.ts: ALBUMS TO CONSIDER, BASED ON THE SHELF
//
//   recommendationsSchema   albums by artists similar to the ones on the
//                           shelf, each with the reason it was suggested
//
// "Because you own Miles Davis and John Coltrane" -> Mingus Ah Um.
// ============================================================================

import { z } from 'zod';

export const recommendationSchema = z.object({
  title: z.string(),
  artist: z.string(),
  coverImageUrl: z.string().nullable(),
  lastfmUrl: z.string().nullable(),
  /** The artists on the shelf this one is similar to (the closest first, up to 3). */
  because: z.array(z.string()),
  /** The wishlist item's id if it's already on the wishlist, otherwise null. */
  wishlistItemId: z.number().int().nullable(),
});

export type Recommendation = z.infer<typeof recommendationSchema>;

export const recommendationsSchema = z.object({
  /** The best matches first (up to 10). */
  recommendations: z.array(recommendationSchema),
  /** The shelf's artists the suggestions were based on. */
  basedOn: z.array(z.string()),
  /** True when built from built-in sample data (a demo without a Last.fm key). */
  sample: z.boolean(),
});

export type Recommendations = z.infer<typeof recommendationsSchema>;
