// ============================================================================
// ratings.ts: STAR RATINGS AND REVIEWS
//
//   ratingSchema        half a star to five stars, in half-star steps
//   reviewInputSchema   what's sent to rate and review a record
//   RATING_STEPS        every possible rating, lowest first: 0.5, 1, ... 5
//
// A record has one rating and one review (the owner's overall opinion). A play
// in the diary can have its own rating too: how that listen went.
// Reviews show on a public profile; notes never do.
// ============================================================================

import { z } from 'zod';

export const RATING_STEPS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5] as const;

export const ratingSchema = z
  .number({ error: 'Pick a rating from half a star to 5 stars' })
  .min(0.5, 'Pick a rating from half a star to 5 stars')
  .max(5, 'Pick a rating from half a star to 5 stars')
  .multipleOf(0.5, 'Ratings go in half-star steps');

/** A rating that can be left out or cleared (null = not rated). */
export const optionalRatingSchema = ratingSchema.nullish().transform((value) => value ?? null);

export const REVIEW_MAX_LENGTH = 5000;

/** Body for PUT /api/records/:id/review. Both can be cleared with null. */
export const reviewInputSchema = z.object({
  rating: optionalRatingSchema,
  review: z
    .string()
    .trim()
    .max(REVIEW_MAX_LENGTH, `Keep the review under ${REVIEW_MAX_LENGTH} characters`)
    .nullish()
    .transform((value) => value || null),
});

export type ReviewInput = z.input<typeof reviewInputSchema>;
export type ParsedReviewInput = z.output<typeof reviewInputSchema>;
