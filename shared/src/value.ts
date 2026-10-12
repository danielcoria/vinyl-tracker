// ============================================================================
// value.ts: WHAT THE COLLECTION IS WORTH, OVER TIME
//
//   collectionValueSchema   the total now, how it moved, a point per day for
//                           the chart, and each record's price
//   priceRefreshSchema      what "Update prices now" did
//
// A record's "price" is the cheapest copy of that exact pressing for sale on
// Discogs. The server looks prices up about once a day and keeps each lookup
// (a "snapshot"); the history is built from those. Only records linked to a
// Discogs release can be priced.
// ============================================================================

import { z } from 'zod';
import { spinRecordSchema } from './spins.js';

export const valuedRecordSchema = z.object({
  record: spinRecordSchema,
  /** The latest price (null when no copy was for sale). */
  price: z.number().nullable(),
  /** The first price ever recorded for it, to show how it moved. */
  firstPrice: z.number().nullable(),
  numForSale: z.number().int(),
  /** When the latest price was looked up. */
  capturedAt: z.string(),
});

export type ValuedRecord = z.infer<typeof valuedRecordSchema>;

export const collectionValueSchema = z.object({
  /** The currency the prices are in, e.g. "USD" (null before any price is known). */
  currency: z.string().nullable(),
  /** True for the demo account: made-up prices, so the chart has something to show. */
  sample: z.boolean(),
  totals: z.object({
    /** Added up from the latest price of every priced record. */
    value: z.number(),
    recordCount: z.number().int(),
    /** Records with a price. */
    pricedCount: z.number().int(),
    /** Linked to Discogs and looked up, but no copy is for sale right now. */
    notForSaleCount: z.number().int(),
    /** Linked to Discogs, but not looked up yet (waiting for a price update). */
    pendingCount: z.number().int(),
    /** Not linked to a Discogs release, so there is no price to look up. */
    unlinkedCount: z.number().int(),
  }),
  /**
   * How prices moved: for records priced more than once, the latest prices
   * added up minus the first ones. (New records aren't "growth", so they're
   * left out.) null until something has been priced twice.
   */
  movement: z
    .object({
      amount: z.number(),
      /** As a share of the first prices, e.g. 0.08 = up 8%. */
      ratio: z.number(),
      /** The date of the earliest first price, "2026-04-12". */
      since: z.string(),
    })
    .nullable(),
  /** One point per day that had a price update, oldest first: "2026-10-12". */
  history: z.array(
    z.object({ date: z.string(), value: z.number(), pricedCount: z.number().int() }),
  ),
  /** Every looked-up record, the most valuable first. */
  records: z.array(valuedRecordSchema),
  /** When prices were last looked up (null = never). */
  lastUpdatedAt: z.string().nullable(),
});

export type CollectionValue = z.infer<typeof collectionValueSchema>;

export const priceRefreshSchema = z.object({
  /** How many records got a new price just now. */
  updated: z.number().int(),
  /** How many are still waiting (prices are looked up a few at a time). */
  remaining: z.number().int(),
});

export type PriceRefresh = z.infer<typeof priceRefreshSchema>;
