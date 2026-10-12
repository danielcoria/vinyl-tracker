// ============================================================================
// value.ts (service): WHAT THE COLLECTION IS WORTH, OVER TIME
//
//   snapshotPrices       looks up today's price for records that haven't been
//                        priced in the last 20 hours, a few at a time, and
//                        saves each one as a "snapshot"
//   getCollectionValue   adds the snapshots up: the total now, a point per
//                        day for the chart, and each record's price
//
// A price is the cheapest copy of that exact pressing for sale on Discogs, so
// only records linked to a Discogs release can be priced.
//
// Nothing here is stored as a total: the value on any day is worked out from
// the snapshots, using each record's most recent price up to that day.
// ============================================================================

import { and, asc, eq, inArray, isNotNull, ne, sql } from 'drizzle-orm';
import type { CollectionValue, PriceRefresh, ValuedRecord } from '@vinyl/shared';
import type { Db } from '../db/client.js';
import { priceSnapshots, records } from '../db/schema.js';
import { DiscogsError, type DiscogsClient } from '../integrations/discogs/client.js';
import { listRecords } from './records.js';

const HOUR_MS = 60 * 60 * 1000;
/** A record is priced again once its latest price is this old ("about once a day"). */
const MIN_AGE_MS = 20 * HOUR_MS;

type SnapshotOptions = {
  /** Only this person's records (the "Update prices now" button). Left out = everyone's. */
  userId?: number;
  /** Skip this person's records (the demo account, whose prices are made up). */
  exceptUserId?: number;
  /** The most records to price in one go, to stay well under Discogs' 60 requests a minute. */
  limit: number;
  /** The current time. Tests pass a fixed one. */
  now?: number;
};

/** Prices the records that are due, oldest price first. */
export async function snapshotPrices(
  db: Db,
  discogs: DiscogsClient,
  { userId, exceptUserId, limit, now = Date.now() }: SnapshotOptions,
): Promise<PriceRefresh> {
  const latest = sql<string | null>`(
    SELECT max(ps.captured_at) FROM price_snapshots ps WHERE ps.record_id = ${records.id}
  )`;
  const cutoff = new Date(now - MIN_AGE_MS).toISOString();
  const due = db
    .select({ id: records.id, releaseId: records.discogsReleaseId })
    .from(records)
    .where(
      and(
        isNotNull(records.discogsReleaseId),
        userId === undefined ? undefined : eq(records.userId, userId),
        exceptUserId === undefined ? undefined : ne(records.userId, exceptUserId),
        sql`(${latest} IS NULL OR ${latest} < ${cutoff})`,
      ),
    )
    // Never-priced records first, then the ones with the oldest price.
    .orderBy(sql`${latest} ASC NULLS FIRST`, asc(records.id))
    .all();

  let updated = 0;
  for (const record of due.slice(0, limit)) {
    if (record.releaseId === null) continue;
    let stats: Awaited<ReturnType<DiscogsClient['getMarketplaceStats']>>;
    try {
      stats = await discogs.getMarketplaceStats(record.releaseId);
    } catch (error) {
      if (error instanceof DiscogsError && error.code === 'DISCOGS_NOT_FOUND') {
        // The release is gone from Discogs: record "no price" so it doesn't block the others.
        stats = { lowest_price: null, num_for_sale: 0 };
      } else {
        // Discogs is busy or unreachable: stop here and try the rest next time.
        break;
      }
    }
    db.insert(priceSnapshots)
      .values({
        recordId: record.id,
        capturedAt: new Date(now).toISOString(),
        lowestPrice: stats.lowest_price?.value ?? null,
        currency: stats.lowest_price?.currency ?? null,
        numForSale: stats.num_for_sale ?? 0,
      })
      .run();
    updated += 1;
  }
  return { updated, remaining: due.length - updated };
}

export function getCollectionValue(
  db: Db,
  userId: number,
  { sample = false }: { sample?: boolean } = {},
): CollectionValue {
  const shelf = listRecords(db, userId, { sort: 'added' });
  const linked = shelf.filter((record) => record.discogsReleaseId !== null);
  const snapshots =
    linked.length === 0
      ? []
      : db
          .select()
          .from(priceSnapshots)
          .where(
            inArray(
              priceSnapshots.recordId,
              linked.map((r) => r.id),
            ),
          )
          .orderBy(asc(priceSnapshots.capturedAt), asc(priceSnapshots.id))
          .all();

  // Prices in different currencies can't be added up, so the most common one is used.
  const currency = mostCommon(snapshots.flatMap((s) => (s.currency ? [s.currency] : [])));
  const priceOf = (snapshot: (typeof snapshots)[number]) =>
    snapshot.currency === currency ? snapshot.lowestPrice : null;

  // Walk through the snapshots in time order, remembering each record's latest
  // price; at the end of each day, the total is one point on the chart.
  const latestPrice = new Map<number, number | null>();
  const firstPrice = new Map<number, { price: number; date: string }>();
  const latestSnapshot = new Map<number, (typeof snapshots)[number]>();
  const history: CollectionValue['history'] = [];
  const closeDay = (date: string) => {
    const prices = [...latestPrice.values()].filter((p) => p !== null);
    history.push({ date, value: round(sum(prices)), pricedCount: prices.length });
  };
  let day: string | null = null;
  for (const snapshot of snapshots) {
    const date = snapshot.capturedAt.slice(0, 10); // "2026-10-12"
    if (day !== null && date !== day) closeDay(day);
    day = date;
    const price = priceOf(snapshot);
    latestPrice.set(snapshot.recordId, price);
    latestSnapshot.set(snapshot.recordId, snapshot);
    if (price !== null && !firstPrice.has(snapshot.recordId)) {
      firstPrice.set(snapshot.recordId, { price, date });
    }
  }
  if (day !== null) closeDay(day);

  const valued = linked.flatMap((record): ValuedRecord[] => {
    const snapshot = latestSnapshot.get(record.id);
    if (!snapshot) return [];
    return [
      {
        record: {
          id: record.id,
          title: record.title,
          artists: record.artists,
          coverImageUrl: record.coverImageUrl,
        },
        price: priceOf(snapshot),
        firstPrice: firstPrice.get(record.id)?.price ?? null,
        numForSale: snapshot.numForSale,
        capturedAt: snapshot.capturedAt,
      },
    ];
  });
  // The most valuable first; records with no copy for sale go last.
  valued.sort(
    (a, b) => (b.price ?? -1) - (a.price ?? -1) || a.record.title.localeCompare(b.record.title),
  );

  // How prices moved, for records that have been priced on more than one day.
  const moved = valued.filter((v) => {
    const first = firstPrice.get(v.record.id);
    const last = latestSnapshot.get(v.record.id);
    return v.price !== null && first && last && last.capturedAt.slice(0, 10) !== first.date;
  });
  const firstTotal = sum(moved.map((v) => v.firstPrice ?? 0));
  const movedTotal = sum(moved.map((v) => v.price ?? 0));
  const earliest = moved
    .map((v) => firstPrice.get(v.record.id)?.date ?? '')
    .sort()
    .at(0);

  const priced = valued.filter((v) => v.price !== null);
  return {
    currency,
    sample,
    totals: {
      value: round(sum(priced.map((v) => v.price ?? 0))),
      recordCount: shelf.length,
      pricedCount: priced.length,
      notForSaleCount: valued.length - priced.length,
      pendingCount: linked.length - valued.length,
      unlinkedCount: shelf.length - linked.length,
    },
    movement:
      moved.length > 0 && firstTotal > 0 && earliest
        ? {
            amount: round(movedTotal - firstTotal),
            ratio: (movedTotal - firstTotal) / firstTotal,
            since: earliest,
          }
        : null,
    history,
    records: valued,
    lastUpdatedAt: snapshots.at(-1)?.capturedAt ?? null,
  };
}

const sum = (numbers: number[]) => numbers.reduce((total, n) => total + n, 0);
/** To whole cents, so adding prices doesn't leave 12.340000000001. */
const round = (amount: number) => Math.round(amount * 100) / 100;

function mostCommon(values: string[]): string | null {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}
