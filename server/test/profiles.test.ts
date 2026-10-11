// ============================================================================
// profiles.test.ts: TESTS FOR PUBLIC PROFILE PAGES
//
// Alex owns two records and has logged three plays. The tests check who can
// see the profile (only Alex until it's made public), that private details
// never appear, and that the "year in records" numbers add up.
// ============================================================================

import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { apiErrorSchema, profileSchema, yearInRecordsSchema } from '@vinyl/shared';
import { createApp } from '../src/app.js';
import { createDb } from '../src/db/client.js';
import { records } from '../src/db/schema.js';
import { addUser, loggedIn, recordInput } from './helpers.js';

function setup() {
  const db = createDb(':memory:');
  const app = createApp({ db });
  const alex = loggedIn(app, addUser(db, 'alex').cookie);
  const blair = loggedIn(app, addUser(db, 'blair').cookie);
  return { db, app, alex, blair, visitor: request(app) };
}

let ctx: ReturnType<typeof setup>;
let kindOfBlue: number;

const SECRET_NOTE = 'secret note about my turntable';

beforeEach(async () => {
  ctx = setup();
  kindOfBlue = (
    await ctx.alex.post('/api/records').send(
      recordInput({
        title: 'Kind of Blue',
        artists: ['Miles Davis'],
        genres: ['Jazz'],
        mediaCondition: 'VG+',
        notes: SECRET_NOTE,
      }),
    )
  ).body.id;
  const blueTrain = (
    await ctx.alex
      .post('/api/records')
      .send(recordInput({ title: 'Blue Train', artists: ['John Coltrane'], genres: ['Jazz'] }))
  ).body.id;

  const play = (recordId: number, playedAt: string, durationSeconds: number) =>
    ctx.alex
      .post('/api/spins')
      .send({ recordId, playedAt, durationSeconds, notes: SECRET_NOTE })
      .expect(201);
  await play(kindOfBlue, '2025-03-10T20:00:00.000Z', 2700);
  await play(kindOfBlue, '2026-02-01T20:00:00.000Z', 1200);
  await play(blueTrain, '2026-02-02T20:00:00.000Z', 2400);
});

const makePublic = () => ctx.alex.put('/api/settings').send({ profilePublic: true }).expect(200);
const code = (body: unknown) => apiErrorSchema.parse(body).error.code;

describe('who can see a profile', () => {
  it('is private at first: visitors and other accounts get "not found"', async () => {
    for (const res of [
      await ctx.visitor.get('/api/profiles/alex'),
      await ctx.blair.get('/api/profiles/alex'),
      await ctx.visitor.get('/api/profiles/alex/years/2026'),
    ]) {
      expect(res.status).toBe(404);
      expect(code(res.body)).toBe('PROFILE_NOT_FOUND');
    }
  });

  it('a private profile looks exactly like one that does not exist', async () => {
    const privateOne = await ctx.visitor.get('/api/profiles/alex');
    const missing = await ctx.visitor.get('/api/profiles/nobody_here');

    expect(missing.status).toBe(privateOne.status);
    expect(missing.body).toEqual(privateOne.body);
  });

  it('the owner can preview their own private profile', async () => {
    const res = await ctx.alex.get('/api/profiles/alex');

    expect(res.status).toBe(200);
    expect(profileSchema.parse(res.body)).toMatchObject({ isPublic: false, isOwner: true });
  });

  it('once made public, anyone can see it, without logging in', async () => {
    await makePublic();

    const res = await ctx.visitor.get('/api/profiles/ALEX'); // capitals don't matter

    expect(res.status).toBe(200);
    const profile = profileSchema.parse(res.body);
    expect(profile).toMatchObject({ isPublic: true, isOwner: false });
    expect(profile.user).toMatchObject({ username: 'alex', displayName: 'alex' });
    expect((await ctx.blair.get('/api/profiles/alex')).body.isOwner).toBe(false);
  });

  it('can be made private again', async () => {
    await makePublic();
    await ctx.alex.put('/api/settings').send({ profilePublic: false }).expect(200);

    expect((await ctx.visitor.get('/api/profiles/alex')).status).toBe(404);
  });
});

describe('the profile page', () => {
  beforeEach(makePublic);

  it("shows the shelf, most-played and recent plays, and nobody else's", async () => {
    await ctx.blair
      .post('/api/records')
      .send(recordInput({ title: "Blair's LP", artists: ['Blair Band'] }));

    const profile = profileSchema.parse((await ctx.visitor.get('/api/profiles/alex')).body);

    expect(profile.totals).toEqual({ recordCount: 2, spinCount: 3, listeningSeconds: 6300 });
    // Sorted by artist: Coltrane before Davis.
    expect(profile.shelf.map((r) => [r.title, r.spinCount])).toEqual([
      ['Blue Train', 1],
      ['Kind of Blue', 2],
    ]);
    expect(profile.topRecords[0]?.record.title).toBe('Kind of Blue');
    expect(profile.topArtists.map((a) => a.name)).toEqual(['Miles Davis', 'John Coltrane']);
    expect(profile.recentPlays.map((p) => p.record.title)).toEqual([
      'Blue Train',
      'Kind of Blue',
      'Kind of Blue',
    ]);
    expect(profile.years).toEqual([2026, 2025]);
    expect(JSON.stringify(profile)).not.toContain("Blair's LP");
  });

  it('never includes notes, record conditions, or anything about the stylus', async () => {
    await ctx.alex.post('/api/styluses').send({ name: 'Secret Stylus', ratedHours: 500 });

    const res = await ctx.visitor.get('/api/profiles/alex');
    const text = JSON.stringify(res.body);

    expect(text).not.toContain(SECRET_NOTE);
    expect(text).not.toContain('VG+');
    expect(text).not.toContain('mediaCondition');
    expect(text).not.toContain('notes');
    expect(text).not.toContain('Secret Stylus');
    expect(text).not.toContain('passwordHash');
  });

  it('counts years in the viewer’s time zone', async () => {
    // 2 AM on Jan 1 2024 in London (UTC) is still the evening of Dec 31 2023
    // in New York (UTC-5).
    await ctx.alex
      .post('/api/spins')
      .send({ recordId: kindOfBlue, playedAt: '2024-01-01T02:00:00.000Z', durationSeconds: 60 });

    const utc = await ctx.visitor.get('/api/profiles/alex');
    const newYork = await ctx.visitor.get('/api/profiles/alex').query({ utcOffsetMinutes: -300 });

    expect(utc.body.years).toEqual([2026, 2025, 2024]);
    expect(newYork.body.years).toEqual([2026, 2025, 2023]);
  });
});

describe('year in records', () => {
  beforeEach(makePublic);

  it("adds up one year's plays, month by month", async () => {
    const res = await ctx.visitor.get('/api/profiles/alex/years/2026');

    expect(res.status).toBe(200);
    const year = yearInRecordsSchema.parse(res.body);
    expect(year.year).toBe(2026);
    expect(year.totals).toEqual({
      spinCount: 2,
      listeningSeconds: 3600,
      recordCount: 2,
      artistCount: 2,
    });
    expect(year.months).toHaveLength(12);
    expect(year.months[0]).toEqual({ month: '2026-01', listeningSeconds: 0 });
    expect(year.months[1]).toEqual({ month: '2026-02', listeningSeconds: 3600 });
    expect(year.topGenres).toEqual([{ name: 'Jazz', listeningSeconds: 3600 }]);
    expect(year.topRecords[0]?.record.title).toBe('Blue Train');
  });

  it('counts records added to the shelf that year', async () => {
    ctx.db.update(records).set({ addedAt: '2025-06-01T00:00:00.000Z' }).run();

    const in2025 = yearInRecordsSchema.parse(
      (await ctx.visitor.get('/api/profiles/alex/years/2025')).body,
    );
    const in2026 = yearInRecordsSchema.parse(
      (await ctx.visitor.get('/api/profiles/alex/years/2026')).body,
    );

    expect(in2025.addedCount).toBe(2);
    expect(in2026.addedCount).toBe(0);
  });

  it('is empty for a year without plays', async () => {
    const year = yearInRecordsSchema.parse(
      (await ctx.visitor.get('/api/profiles/alex/years/2019')).body,
    );

    expect(year.totals.spinCount).toBe(0);
    expect(year.months.every((m) => m.listeningSeconds === 0)).toBe(true);
    expect(year.topGenres).toEqual([]);
  });

  it('rejects years that are not years', async () => {
    for (const bad of ['twenty', '1850', '2026.5']) {
      const res = await ctx.visitor.get(`/api/profiles/alex/years/${bad}`);
      expect(res.status, bad).toBe(400);
      expect(code(res.body)).toBe('VALIDATION');
    }
  });
});
