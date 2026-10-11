// ============================================================================
// ratings.test.ts: TESTS FOR STAR RATINGS AND REVIEWS
//
// Rating and reviewing a record, rating a single play, sorting by rating, the
// spread of ratings in the stats, and what shows up on a public profile.
// ============================================================================

import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  apiErrorSchema,
  profileSchema,
  recordListSchema,
  recordSchema,
  spinSchema,
  statsSchema,
  yearInRecordsSchema,
} from '@vinyl/shared';
import { addUser, loggedIn, makeTestApp, recordInput } from './helpers.js';

let ctx: ReturnType<typeof makeTestApp>;

beforeEach(() => {
  ctx = makeTestApp();
});

async function addRecord(title: string, artist = 'Someone'): Promise<number> {
  const res = await ctx.api.post('/api/records').send(recordInput({ title, artists: [artist] }));
  return res.body.id;
}

const review = (id: number, body: object) => ctx.api.put(`/api/records/${id}/review`).send(body);
const message = (body: unknown) => apiErrorSchema.parse(body).error.message;

describe('rating and reviewing a record', () => {
  it('starts with no rating or review', async () => {
    const id = await addRecord('Kind of Blue');

    const record = recordSchema.parse((await ctx.api.get(`/api/records/${id}`)).body);

    expect(record).toMatchObject({ rating: null, review: null, reviewedAt: null });
  });

  it('saves stars and a review, and remembers when', async () => {
    const id = await addRecord('Kind of Blue');

    const res = await review(id, { rating: 4.5, review: '  Perfect late at night.  ' });

    expect(res.status).toBe(200);
    const record = recordSchema.parse(res.body);
    expect(record.rating).toBe(4.5);
    expect(record.review).toBe('Perfect late at night.'); // trimmed
    expect(Date.parse(record.reviewedAt ?? '')).toBeGreaterThan(Date.now() - 5000);
  });

  it('can rate without a review, and clear both', async () => {
    const id = await addRecord('Kind of Blue');

    expect((await review(id, { rating: 3 })).body).toMatchObject({ rating: 3, review: null });
    const cleared = await review(id, { rating: null, review: '' });

    expect(cleared.body).toMatchObject({ rating: null, review: null, reviewedAt: null });
  });

  it('only accepts half a star to five stars, in half steps', async () => {
    const id = await addRecord('Kind of Blue');

    for (const rating of [0, 5.5, 4.3, -1, 'five']) {
      const res = await review(id, { rating });
      expect(res.status, String(rating)).toBe(400);
    }
    expect(message((await review(id, { rating: 4.3 })).body)).toBe(
      'rating: Ratings go in half-star steps',
    );
  });

  it('keeps the review when the record itself is edited', async () => {
    const id = await addRecord('Kind of Blue');
    await review(id, { rating: 5, review: 'A classic.' });

    const res = await ctx.api
      .put(`/api/records/${id}`)
      .send(recordInput({ title: 'Kind of Blue (Mono)' }));

    expect(res.body).toMatchObject({
      title: 'Kind of Blue (Mono)',
      rating: 5,
      review: 'A classic.',
    });
  });

  it("can't review someone else's record", async () => {
    const id = await addRecord('Kind of Blue');
    const blair = loggedIn(ctx.app, addUser(ctx.db, 'blair').cookie);

    const res = await blair.put(`/api/records/${id}/review`).send({ rating: 1 });

    expect(res.status).toBe(404);
    expect((await ctx.api.get(`/api/records/${id}`)).body.rating).toBeNull();
  });

  it('sorts the collection by rating, unrated last', async () => {
    const low = await addRecord('Low');
    await addRecord('Unrated');
    const high = await addRecord('High');
    await review(low, { rating: 2 });
    await review(high, { rating: 4.5 });

    const res = await ctx.api.get('/api/records').query({ sort: 'rating' });

    expect(recordListSchema.parse(res.body).records.map((r) => r.title)).toEqual([
      'High',
      'Low',
      'Unrated',
    ]);
  });
});

describe('rating a play', () => {
  it('saves the stars with the play, or none', async () => {
    const id = await addRecord('Kind of Blue');

    const rated = await ctx.api
      .post('/api/spins')
      .send({ recordId: id, durationSeconds: 1200, rating: 3.5 });
    const unrated = await ctx.api.post('/api/spins').send({ recordId: id, durationSeconds: 1200 });

    expect(spinSchema.parse(rated.body).rating).toBe(3.5);
    expect(spinSchema.parse(unrated.body).rating).toBeNull();
    // Rating a play doesn't change the record's own rating.
    expect((await ctx.api.get(`/api/records/${id}`)).body.rating).toBeNull();
  });

  it('rejects ratings that are not half-star steps', async () => {
    const id = await addRecord('Kind of Blue');

    const res = await ctx.api
      .post('/api/spins')
      .send({ recordId: id, durationSeconds: 1200, rating: 7 });

    expect(res.status).toBe(400);
  });
});

describe('ratings in the stats', () => {
  it('counts how many records got each rating, with the average', async () => {
    await review(await addRecord('A'), { rating: 5 });
    await review(await addRecord('B'), { rating: 5 });
    await review(await addRecord('C'), { rating: 3.5 });
    await addRecord('Unrated');

    const { ratings } = statsSchema.parse((await ctx.api.get('/api/stats')).body);

    expect(ratings.ratedCount).toBe(3);
    expect(ratings.average).toBe(4.5);
    expect(ratings.counts).toHaveLength(10);
    expect(ratings.counts.filter((c) => c.count > 0)).toEqual([
      { rating: 3.5, count: 1 },
      { rating: 5, count: 2 },
    ]);
  });

  it('has no average when nothing is rated', async () => {
    await addRecord('Unrated');

    const { ratings } = statsSchema.parse((await ctx.api.get('/api/stats')).body);

    expect(ratings).toMatchObject({ ratedCount: 0, average: null });
  });
});

describe('ratings and reviews on a public profile', () => {
  const SECRET_NOTE = 'private note, never shared';
  let best: number;

  beforeEach(async () => {
    best = await addRecord('Best', 'Artist A');
    const good = await addRecord('Good', 'Artist B');
    await addRecord('Unrated', 'Artist C');
    await review(best, { rating: 5, review: 'The best one.' });
    await review(good, { rating: 4 });
    await ctx.api.post('/api/spins').send({
      recordId: good,
      playedAt: '2026-03-01T20:00:00.000Z',
      durationSeconds: 1200,
      rating: 4.5,
      notes: SECRET_NOTE,
    });
    await ctx.api.put('/api/settings').send({ profilePublic: true });
  });

  it('shows highest rated records, reviews, and stars on the shelf and plays', async () => {
    const res = await request(ctx.app).get('/api/profiles/tester');

    const profile = profileSchema.parse(res.body);
    expect(profile.highestRated.map((r) => [r.record.title, r.rating])).toEqual([
      ['Best', 5],
      ['Good', 4],
    ]);
    expect(profile.reviews).toHaveLength(1);
    expect(profile.reviews[0]).toMatchObject({ rating: 5, review: 'The best one.' });
    expect(profile.reviews[0]?.record.title).toBe('Best');
    expect(profile.shelf.map((r) => r.rating)).toEqual([5, 4, null]);
    expect(profile.recentPlays[0]?.rating).toBe(4.5);
    // Reviews are shared; notes still never are.
    expect(JSON.stringify(res.body)).not.toContain(SECRET_NOTE);
  });

  it("picks the year's highest rated record from the ones played that year", async () => {
    // "Best" has 5 stars but wasn't played in 2026; "Good" was.
    const in2026 = yearInRecordsSchema.parse(
      (await request(ctx.app).get('/api/profiles/tester/years/2026')).body,
    );
    expect(in2026.highestRated).toMatchObject({ rating: 4 });
    expect(in2026.highestRated?.record.title).toBe('Good');

    await ctx.api
      .post('/api/spins')
      .send({ recordId: best, playedAt: '2026-04-01T20:00:00.000Z', durationSeconds: 600 });
    const after = yearInRecordsSchema.parse(
      (await request(ctx.app).get('/api/profiles/tester/years/2026')).body,
    );
    expect(after.highestRated?.record.title).toBe('Best');

    const in2020 = yearInRecordsSchema.parse(
      (await request(ctx.app).get('/api/profiles/tester/years/2020')).body,
    );
    expect(in2020.highestRated).toBeNull();
  });
});
