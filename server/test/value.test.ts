// ============================================================================
// value.test.ts: TESTS FOR THE COLLECTION'S VALUE OVER TIME
//
// Alex owns three records linked to Discogs releases 101, 102 and 103, and one
// added by hand (no link, so no price). The pretend Discogs answers with
// whatever prices the test sets, and "now" is moved forward a day at a time to
// build up a history.
// ============================================================================

import { eq } from 'drizzle-orm';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { apiErrorSchema, collectionValueSchema, priceRefreshSchema } from '@vinyl/shared';
import { createApp } from '../src/app.js';
import { createDb } from '../src/db/client.js';
import { seedDemoData } from '../src/db/demo.js';
import { priceSnapshots, records } from '../src/db/schema.js';
import { getCollectionValue, snapshotPrices } from '../src/services/value.js';
import { fakeDiscogs } from './discogs-helpers.js';
import { addUser, loggedIn, recordInput } from './helpers.js';

const DAY = 24 * 60 * 60 * 1000;
const DAY_1 = Date.parse('2026-10-01T12:00:00.000Z');

type Price = { value: number; currency?: string; forSale?: number } | null | 'busy' | 'gone';

function setup() {
  const db = createDb(':memory:');
  // What each release "sells for" right now. Tests change these between days.
  const prices: Record<number, Price> = { 101: { value: 30 }, 102: { value: 20 }, 103: null };
  const discogs = fakeDiscogs(
    Object.fromEntries(
      [101, 102, 103, 201].map((releaseId) => [
        `/marketplace/stats/${releaseId}`,
        () => {
          const price = prices[releaseId];
          if (price === 'busy') return Response.json({ message: 'Slow down' }, { status: 429 });
          if (price === 'gone' || price === undefined) {
            return Response.json({ message: 'Release not found.' }, { status: 404 });
          }
          return Response.json({
            lowest_price: price ? { value: price.value, currency: price.currency ?? 'USD' } : null,
            num_for_sale: price ? (price.forSale ?? 10) : 0,
          });
        },
      ]),
    ),
    // The Discogs client remembers answers for 6 hours by its own clock; keep it
    // moving so each "day" really asks again.
    { now: () => clock.now },
  );
  const clock = { now: DAY_1 };
  const app = createApp({ db, discogs: discogs.client });
  const alexUser = addUser(db, 'alex');
  const alex = loggedIn(app, alexUser.cookie);
  const blairUser = addUser(db, 'blair');
  const blair = loggedIn(app, blairUser.cookie);

  /** Adds a record and links it to a Discogs release (as an import would). */
  async function add(who: typeof alex, title: string, releaseId: number | null) {
    const id = (await who.post('/api/records').send(recordInput({ title }))).body.id as number;
    if (releaseId !== null) {
      db.update(records).set({ discogsReleaseId: releaseId }).where(eq(records.id, id)).run();
    }
    return id;
  }
  /** Looks prices up as if it were `day` (1 = the first day). */
  const snapshotOn = (day: number, options: { userId?: number; limit?: number } = {}) => {
    clock.now = DAY_1 + (day - 1) * DAY;
    return snapshotPrices(db, discogs.client, { limit: 50, now: clock.now, ...options });
  };
  return {
    db,
    app,
    alex,
    blair,
    alexId: alexUser.user.id,
    blairId: blairUser.user.id,
    prices,
    discogs,
    add,
    snapshotOn,
  };
}

let ctx: ReturnType<typeof setup>;
let ids: { a: number; b: number; c: number; manual: number };

beforeEach(async () => {
  ctx = setup();
  ids = {
    a: await ctx.add(ctx.alex, 'Album A', 101),
    b: await ctx.add(ctx.alex, 'Album B', 102),
    c: await ctx.add(ctx.alex, 'Album C', 103),
    manual: await ctx.add(ctx.alex, 'Added By Hand', null),
  };
});

const snapshotsOf = (recordId: number) =>
  ctx.db.select().from(priceSnapshots).where(eq(priceSnapshots.recordId, recordId)).all();

describe('looking up prices', () => {
  it('saves a price for every record linked to Discogs', async () => {
    const result = await ctx.snapshotOn(1);

    expect(result).toEqual({ updated: 3, remaining: 0 });
    expect(snapshotsOf(ids.a)).toMatchObject([
      { lowestPrice: 30, currency: 'USD', numForSale: 10, capturedAt: '2026-10-01T12:00:00.000Z' },
    ]);
    // No copy for sale: saved as "no price", not skipped.
    expect(snapshotsOf(ids.c)).toMatchObject([
      { lowestPrice: null, currency: null, numForSale: 0 },
    ]);
    expect(snapshotsOf(ids.manual)).toEqual([]);
  });

  it('prices a record about once a day, not every time it is asked', async () => {
    await ctx.snapshotOn(1);

    expect(await ctx.snapshotOn(1.5)).toEqual({ updated: 0, remaining: 0 }); // 12 hours later
    expect(await ctx.snapshotOn(2)).toEqual({ updated: 3, remaining: 0 }); // a day later
    expect(snapshotsOf(ids.a)).toHaveLength(2);
  });

  it('does a few at a time, starting with the ones waiting longest', async () => {
    const first = await ctx.snapshotOn(1, { limit: 2 });
    expect(first).toEqual({ updated: 2, remaining: 1 });
    expect(snapshotsOf(ids.c)).toEqual([]); // the third is still waiting

    // The next round does the one that was left out.
    expect(await ctx.snapshotOn(1.01, { limit: 2 })).toEqual({ updated: 1, remaining: 0 });
    expect(snapshotsOf(ids.c)).toHaveLength(1);
  });

  it('stops when Discogs is busy, and picks up where it left off', async () => {
    ctx.prices[102] = 'busy';

    expect(await ctx.snapshotOn(1)).toEqual({ updated: 1, remaining: 2 });

    ctx.prices[102] = { value: 20 };
    expect(await ctx.snapshotOn(1.01)).toEqual({ updated: 2, remaining: 0 });
  });

  it('records "no price" for a release that has left Discogs, instead of getting stuck', async () => {
    ctx.prices[101] = 'gone';

    expect(await ctx.snapshotOn(1)).toEqual({ updated: 3, remaining: 0 });
    expect(snapshotsOf(ids.a)).toMatchObject([{ lowestPrice: null }]);
  });

  it('can be limited to one person, or skip one', async () => {
    const blairs = await ctx.add(ctx.blair, "Blair's Album", 201);
    ctx.prices[201] = { value: 99 };

    await ctx.snapshotOn(1, { userId: ctx.blairId });
    expect(snapshotsOf(blairs)).toHaveLength(1);
    expect(snapshotsOf(ids.a)).toEqual([]);

    // Two days later everything is due, but Alex's records are skipped on purpose.
    const result = await snapshotPrices(ctx.db, ctx.discogs.client, {
      limit: 50,
      exceptUserId: ctx.alexId,
      now: DAY_1 + 2 * DAY,
    });
    expect(result).toEqual({ updated: 1, remaining: 0 });
    expect(snapshotsOf(blairs)).toHaveLength(2);
    expect(snapshotsOf(ids.a)).toEqual([]);
  });
});

describe('the collection value', () => {
  it('is empty before any price is known', () => {
    const value = getCollectionValue(ctx.db, ctx.alexId);

    expect(value).toMatchObject({
      currency: null,
      sample: false,
      totals: {
        value: 0,
        recordCount: 4,
        pricedCount: 0,
        notForSaleCount: 0,
        pendingCount: 3,
        unlinkedCount: 1,
      },
      movement: null,
      history: [],
      records: [],
      lastUpdatedAt: null,
    });
  });

  it('adds up the latest prices and lists records, the most valuable first', async () => {
    await ctx.snapshotOn(1);

    const value = getCollectionValue(ctx.db, ctx.alexId);

    expect(value.currency).toBe('USD');
    expect(value.totals).toEqual({
      value: 50,
      recordCount: 4,
      pricedCount: 2,
      notForSaleCount: 1,
      pendingCount: 0,
      unlinkedCount: 1,
    });
    expect(value.records.map((r) => [r.record.title, r.price])).toEqual([
      ['Album A', 30],
      ['Album B', 20],
      ['Album C', null], // nothing for sale: listed last
    ]);
    expect(value.lastUpdatedAt).toBe('2026-10-01T12:00:00.000Z');
    // One day of prices: nothing has "moved" yet.
    expect(value.movement).toBeNull();
  });

  it('builds a point per day, and shows how prices moved', async () => {
    await ctx.snapshotOn(1); // A 30, B 20, C none
    ctx.prices[101] = { value: 36 };
    ctx.prices[103] = { value: 10 };
    await ctx.snapshotOn(2); // A 36, B 20, C 10
    ctx.prices[102] = null;
    await ctx.snapshotOn(3); // A 36, B none, C 10

    const value = getCollectionValue(ctx.db, ctx.alexId);

    expect(value.history).toEqual([
      { date: '2026-10-01', value: 50, pricedCount: 2 },
      { date: '2026-10-02', value: 66, pricedCount: 3 },
      { date: '2026-10-03', value: 46, pricedCount: 2 },
    ]);
    expect(value.totals.value).toBe(46);
    // Records priced on more than one day: A went from 30 to 36, and C stayed at 10
    // (first priced on day 2). B has no price now, so it's left out.
    // 40 before, 46 now: up 6, which is 15%.
    expect(value.movement).toEqual({ amount: 6, ratio: 0.15, since: '2026-10-01' });
    expect(value.records.find((r) => r.record.title === 'Album A')).toMatchObject({
      price: 36,
      firstPrice: 30,
    });
  });

  it("carries a record's last price forward on days it wasn't looked up", async () => {
    await ctx.snapshotOn(1); // A 30, B 20
    ctx.prices[101] = { value: 40 };
    // Day 2: only one record gets looked up (the batch is small).
    await ctx.snapshotOn(2, { limit: 1 });

    const { history } = getCollectionValue(ctx.db, ctx.alexId);

    // B wasn't looked up on day 2, but it's still worth 20.
    expect(history.at(-1)).toEqual({ date: '2026-10-02', value: 60, pricedCount: 2 });
  });

  it('leaves out prices in another currency rather than adding dollars to euros', async () => {
    ctx.prices[103] = { value: 500, currency: 'EUR' };
    await ctx.snapshotOn(1);

    const value = getCollectionValue(ctx.db, ctx.alexId);

    expect(value.currency).toBe('USD');
    expect(value.totals.value).toBe(50);
    expect(value.records.find((r) => r.record.title === 'Album C')?.price).toBeNull();
  });

  it('forgets a record’s prices when the record is deleted', async () => {
    await ctx.snapshotOn(1);

    await ctx.alex.delete(`/api/records/${ids.a}`).expect(204);

    expect(snapshotsOf(ids.a)).toEqual([]);
    expect(getCollectionValue(ctx.db, ctx.alexId).totals.value).toBe(20);
  });
});

describe('the value addresses', () => {
  it('GET /api/value gives the value, POST /api/value/refresh looks prices up now', async () => {
    const before = await ctx.alex.get('/api/value');
    expect(collectionValueSchema.parse(before.body).totals.pendingCount).toBe(3);

    const refresh = await ctx.alex.post('/api/value/refresh');

    expect(refresh.status).toBe(200);
    expect(priceRefreshSchema.parse(refresh.body)).toEqual({ updated: 3, remaining: 0 });
    const after = collectionValueSchema.parse((await ctx.alex.get('/api/value')).body);
    expect(after.totals).toMatchObject({ value: 50, pricedCount: 2, pendingCount: 0 });
    expect(after.history).toHaveLength(1);
  });

  it('only shows and refreshes your own records', async () => {
    await ctx.add(ctx.blair, "Blair's Album", 201);
    ctx.prices[201] = { value: 99 };

    await ctx.alex.post('/api/value/refresh').expect(200);

    const blairs = collectionValueSchema.parse((await ctx.blair.get('/api/value')).body);
    // Alex's refresh didn't price Blair's record, and Blair doesn't see Alex's.
    expect(blairs.totals).toMatchObject({ value: 0, recordCount: 1, pendingCount: 1 });
    expect(blairs.records).toEqual([]);
  });

  it('needs a login, and Discogs to refresh', async () => {
    expect((await request(ctx.app).get('/api/value')).status).toBe(401);
    expect((await request(ctx.app).post('/api/value/refresh')).status).toBe(401);

    const db = createDb(':memory:');
    const noDiscogs = loggedIn(createApp({ db }), addUser(db, 'alex').cookie);
    // The value itself still works without Discogs (it only reads saved prices)...
    expect((await noDiscogs.get('/api/value')).status).toBe(200);
    // ...but there's nothing to look new prices up with.
    const res = await noDiscogs.post('/api/value/refresh');
    expect(res.status).toBe(503);
    expect(apiErrorSchema.parse(res.body).error.code).toBe('DISCOGS_NOT_CONFIGURED');
  });
});

describe('the demo account', () => {
  it('has a made-up price history, marked as a sample, that is never refreshed', async () => {
    const db = createDb(':memory:');
    const now = Date.parse('2026-10-09T12:00:00.000Z');
    seedDemoData(db, now);
    const discogs = fakeDiscogs();
    const app = createApp({ db, discogs: discogs.client, demo: true });
    const agent = request.agent(app);
    await agent.post('/api/auth/demo').expect(200);

    const value = collectionValueSchema.parse((await agent.get('/api/value')).body);

    expect(value.sample).toBe(true);
    expect(value.currency).toBe('USD');
    expect(value.totals).toMatchObject({ recordCount: 14, pricedCount: 14, pendingCount: 0 });
    // Today's prices are the tidy made-up ones: 34 + 28 + 22 + ... = 489.
    expect(value.totals.value).toBe(489);
    // Six months of weekly points, growing as albums joined the shelf and prices crept up.
    expect(value.history).toHaveLength(27);
    expect(value.history[0]?.value).toBeLessThan(value.totals.value);
    expect(value.movement?.amount).toBeGreaterThan(0);

    // "Update prices now" does nothing for the demo account, and asks Discogs nothing.
    const refresh = await agent.post('/api/value/refresh');
    expect(refresh.body).toEqual({ updated: 0, remaining: 0 });
    expect(discogs.requests).toEqual([]);
  });

  it('is skipped by the automatic price updates', async () => {
    const db = createDb(':memory:');
    const now = Date.parse('2026-10-09T12:00:00.000Z');
    const { userId } = seedDemoData(db, now);
    const discogs = fakeDiscogs();

    // A week later every demo record would be "due", but the demo account is left out.
    const result = await snapshotPrices(db, discogs.client, {
      limit: 50,
      exceptUserId: userId,
      now: now + 7 * DAY,
    });

    expect(result).toEqual({ updated: 0, remaining: 0 });
    expect(discogs.requests).toEqual([]);
  });
});
