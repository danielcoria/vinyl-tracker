// ============================================================================
// isolation.test.ts: EVERYONE ONLY SEES AND CHANGES THEIR OWN THINGS
//
// Two accounts, Alex and Blair. Blair tries to read, change and delete Alex's
// records, plays, stylus and settings, and is refused every time ("not found",
// as if they didn't exist), while Alex's data stays untouched.
// ============================================================================

import { eq } from 'drizzle-orm';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  apiErrorSchema,
  discogsSearchResponseSchema,
  meResponseSchema,
  recordListSchema,
  spinListSchema,
  statsSchema,
  stylusListSchema,
} from '@vinyl/shared';
import { createApp } from '../src/app.js';
import { createDb } from '../src/db/client.js';
import { records, styluses } from '../src/db/schema.js';
import { replaceTracks } from '../src/services/tracks.js';
import { fakeDiscogs, KIND_OF_BLUE_RELEASE_ID } from './discogs-helpers.js';
import { addUser, loggedIn, recordInput } from './helpers.js';

function twoPeople() {
  const db = createDb(':memory:');
  const app = createApp({ db, discogs: fakeDiscogs().client });
  const alex = loggedIn(app, addUser(db, 'alex').cookie);
  const blair = loggedIn(app, addUser(db, 'blair').cookie);
  return { db, app, alex, blair };
}

let ctx: ReturnType<typeof twoPeople>;
let alexRecordId: number;
let alexSpinId: number;
let alexStylusId: number;

beforeEach(async () => {
  ctx = twoPeople();
  alexRecordId = (await ctx.alex.post('/api/records').send(recordInput({ title: "Alex's LP" })))
    .body.id;
  replaceTracks(ctx.db, alexRecordId, [
    { position: 'A1', side: 'A', title: 'One', durationSeconds: 600, sortOrder: 0 },
    { position: 'B1', side: 'B', title: 'Two', durationSeconds: 600, sortOrder: 1 },
  ]);
  alexSpinId = (
    await ctx.alex.post('/api/spins').send({ recordId: alexRecordId, durationSeconds: 1200 })
  ).body.id;
  alexStylusId = (
    await ctx.alex.post('/api/styluses').send({ name: "Alex's stylus", ratedHours: 500 })
  ).body.id;
});

const code = (body: unknown) => apiErrorSchema.parse(body).error.code;

describe('without logging in', () => {
  it('nothing is available except logging in and the health check', async () => {
    const visitor = request(ctx.app);

    for (const address of [
      '/api/records',
      '/api/spins',
      '/api/stats',
      '/api/dust',
      '/api/styluses',
      '/api/settings',
    ]) {
      const res = await visitor.get(address);
      expect(res.status, address).toBe(401);
      expect(code(res.body)).toBe('NOT_LOGGED_IN');
    }
    expect((await visitor.get('/api/health')).status).toBe(200);
    expect((await visitor.get('/api/auth/me')).status).toBe(200);
  });
});

describe("someone else's records", () => {
  it("don't show up in your collection or searches", async () => {
    const list = recordListSchema.parse((await ctx.blair.get('/api/records')).body);
    const search = recordListSchema.parse(
      (await ctx.blair.get('/api/records').query({ q: 'Alex' })).body,
    );

    expect(list.records).toEqual([]);
    expect(search.records).toEqual([]);
  });

  it("can't be opened, edited, deleted, or have their tracklist read", async () => {
    const url = `/api/records/${alexRecordId}`;

    expect((await ctx.blair.get(url)).status).toBe(404);
    expect((await ctx.blair.put(url).send(recordInput({ title: 'Mine now' }))).status).toBe(404);
    expect((await ctx.blair.delete(url)).status).toBe(404);
    expect((await ctx.blair.get(`${url}/tracks`)).status).toBe(404);

    const stillAlexs = await ctx.alex.get(url);
    expect(stillAlexs.status).toBe(200);
    expect(stillAlexs.body.title).toBe("Alex's LP");
  });
});

describe("someone else's plays", () => {
  it("can't be logged, seen or deleted", async () => {
    const logOnAlexs = await ctx.blair
      .post('/api/spins')
      .send({ recordId: alexRecordId, durationSeconds: 60 });
    expect(logOnAlexs.status).toBe(404);

    const blairsDiary = spinListSchema.parse((await ctx.blair.get('/api/spins')).body);
    expect(blairsDiary.spins).toEqual([]);
    const filtered = await ctx.blair.get('/api/spins').query({ recordId: alexRecordId });
    expect(spinListSchema.parse(filtered.body).spins).toEqual([]);

    expect((await ctx.blair.delete(`/api/spins/${alexSpinId}`)).status).toBe(404);
    const alexsDiary = spinListSchema.parse((await ctx.alex.get('/api/spins')).body);
    expect(alexsDiary.spins.map((s) => s.id)).toEqual([alexSpinId]);
  });

  it("don't count in your stats or dust report", async () => {
    const stats = statsSchema.parse((await ctx.blair.get('/api/stats')).body);
    expect(stats.totals.spinCount).toBe(0);

    const dust = await ctx.blair.get('/api/dust');
    expect(dust.body.collectionCount).toBe(0);
  });
});

describe('styluses and settings', () => {
  it("someone else's stylus can't be seen, edited or deleted", async () => {
    expect(stylusListSchema.parse((await ctx.blair.get('/api/styluses')).body).styluses).toEqual(
      [],
    );
    const url = `/api/styluses/${alexStylusId}`;
    expect(
      (await ctx.blair.put(url).send({ name: 'x', ratedHours: 100, initialHours: 0 })).status,
    ).toBe(404);
    expect((await ctx.blair.delete(url)).status).toBe(404);
  });

  it("installing your stylus doesn't retire anyone else's", async () => {
    await ctx.blair.post('/api/styluses').send({ name: "Blair's stylus", ratedHours: 500 });

    const alexs = stylusListSchema.parse((await ctx.alex.get('/api/styluses')).body).styluses;
    expect(alexs.map((s) => [s.name, s.retiredAt])).toEqual([["Alex's stylus", null]]);
  });

  it('only your own plays wear your stylus', async () => {
    await ctx.blair.post('/api/styluses').send({ name: "Blair's stylus", ratedHours: 500 });

    const [blairs] = stylusListSchema.parse((await ctx.blair.get('/api/styluses')).body).styluses;
    expect(blairs?.spinCount).toBe(0);
  });

  it('settings are kept separately', async () => {
    await ctx.alex.put('/api/settings').send({ dustThresholdDays: 30 });

    expect((await ctx.alex.get('/api/settings')).body).toEqual({ dustThresholdDays: 30 });
    expect((await ctx.blair.get('/api/settings')).body).toEqual({ dustThresholdDays: 90 });
  });
});

describe('Discogs', () => {
  it('two people can each import the same pressing, but only once each', async () => {
    const alexImport = await ctx.alex
      .post('/api/discogs/import')
      .send({ releaseId: KIND_OF_BLUE_RELEASE_ID });
    const blairImport = await ctx.blair
      .post('/api/discogs/import')
      .send({ releaseId: KIND_OF_BLUE_RELEASE_ID });
    const blairAgain = await ctx.blair
      .post('/api/discogs/import')
      .send({ releaseId: KIND_OF_BLUE_RELEASE_ID });

    expect(alexImport.status).toBe(201);
    expect(blairImport.status).toBe(201);
    expect(blairAgain.status).toBe(409);
  });

  it('"in your collection" means your own collection', async () => {
    await ctx.alex.post('/api/discogs/import').send({ releaseId: KIND_OF_BLUE_RELEASE_ID });

    const inCollection = async (person: typeof ctx.alex) =>
      discogsSearchResponseSchema
        .parse((await person.get('/api/discogs/search').query({ q: 'kind of blue' })).body)
        .results.find((r) => r.releaseId === KIND_OF_BLUE_RELEASE_ID)?.inCollectionId;

    expect(await inCollection(ctx.alex)).toEqual(expect.any(Number));
    expect(await inCollection(ctx.blair)).toBeNull();
  });

  it("can't link someone else's record", async () => {
    const res = await ctx.blair
      .post('/api/discogs/link')
      .send({ recordId: alexRecordId, releaseId: KIND_OF_BLUE_RELEASE_ID });

    expect(res.status).toBe(404);
  });
});

describe('data from before accounts existed', () => {
  it('goes to the first account created, and only the first', async () => {
    const db = createDb(':memory:');
    const app = createApp({ db });
    // A record and a stylus with no owner, as in a database from before accounts.
    db.insert(records)
      .values({
        title: 'Old record',
        addedAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      })
      .run();
    db.insert(styluses)
      .values({ name: 'Old stylus', ratedHours: 500, installedAt: '2026-01-01T00:00:00.000Z' })
      .run();

    const first = request.agent(app);
    await first
      .post('/api/auth/signup')
      .send({ username: 'first', password: 'long enough password' });
    const second = request.agent(app);
    await second
      .post('/api/auth/signup')
      .send({ username: 'second', password: 'long enough password' });

    expect(
      recordListSchema.parse((await first.get('/api/records')).body).records.map((r) => r.title),
    ).toEqual(['Old record']);
    expect(stylusListSchema.parse((await first.get('/api/styluses')).body).styluses).toHaveLength(
      1,
    );
    expect(recordListSchema.parse((await second.get('/api/records')).body).records).toEqual([]);
    expect(db.select().from(records).where(eq(records.title, 'Old record')).get()?.userId).toBe(
      meResponseSchema.parse((await first.get('/api/auth/me')).body).user?.id,
    );
  });
});

describe('the demo account', () => {
  it('"Try the demo" logs in to the shared demo account on the demo site', async () => {
    const db = createDb(':memory:');
    const app = createApp({ db, demo: true });
    const visitor = request.agent(app);

    const res = await visitor.post('/api/auth/demo');

    expect(res.status).toBe(200);
    expect(meResponseSchema.parse(res.body).user?.username).toBe('demo');
    expect((await visitor.get('/api/records')).status).toBe(200);
  });

  it('does not exist on other sites', async () => {
    const res = await request(ctx.app).post('/api/auth/demo');
    expect(res.status).toBe(404);
  });

  it('cannot be logged into with a password', async () => {
    const db = createDb(':memory:');
    const app = createApp({ db, demo: true });
    await request(app).post('/api/auth/demo'); // creates the account

    for (const password of ['', 'no-password:demo-account', 'demo', 'password123']) {
      const res = await request(app).post('/api/auth/login').send({ username: 'demo', password });
      expect(res.status).not.toBe(200);
    }
  });
});
