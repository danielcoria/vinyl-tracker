// ============================================================================
// stats.test.ts: TESTS FOR THE STATS PAGE NUMBERS
//
// A small diary with known numbers, so every total can be checked by hand:
//   Kind of Blue (Miles Davis, Jazz)                     2700s in Sep + 1200s in Oct
//   The Velvet Underground & Nico (2 artists, Rock)      3000s in Oct
//   To Pimp a Butterfly (Hip Hop, Jazz, Funk / Soul)     4500s in Oct (1500s per genre)
//   Untagged (no genres)                                  600s in Oct
// ============================================================================

import { beforeEach, describe, expect, it } from 'vitest';
import { statsSchema, type RecordInput } from '@vinyl/shared';
import { monthsBetween } from '../src/services/stats.js';
import { makeTestApp, recordInput } from './helpers.js';

let ctx: ReturnType<typeof makeTestApp>;

async function addRecord(overrides: Partial<RecordInput>): Promise<number> {
  const res = await ctx.api.post('/api/records').send(recordInput(overrides));
  return res.body.id;
}

async function play(recordId: number, playedAt: string, durationSeconds: number) {
  const res = await ctx.api.post('/api/spins').send({ recordId, playedAt, durationSeconds });
  expect(res.status).toBe(201);
}

async function stats(query: Record<string, string | number> = {}) {
  const res = await ctx.api.get('/api/stats').query(query);
  expect(res.status).toBe(200);
  return statsSchema.parse(res.body);
}

let ids: { kob: number; vu: number; tpab: number; untagged: number };

beforeEach(async () => {
  ctx = makeTestApp();
  ids = {
    kob: await addRecord({ title: 'Kind of Blue', artists: ['Miles Davis'], genres: ['Jazz'] }),
    vu: await addRecord({
      title: 'The Velvet Underground & Nico',
      artists: ['The Velvet Underground', 'Nico'],
      genres: ['Rock'],
    }),
    tpab: await addRecord({
      title: 'To Pimp a Butterfly',
      artists: ['Kendrick Lamar'],
      genres: ['Hip Hop', 'Jazz', 'Funk / Soul'],
    }),
    untagged: await addRecord({ title: 'Untagged', artists: ['Someone'], genres: [] }),
  };
  await play(ids.kob, '2026-09-15T12:00:00.000Z', 2700);
  await play(ids.kob, '2026-10-02T12:00:00.000Z', 1200);
  await play(ids.vu, '2026-10-03T12:00:00.000Z', 3000);
  await play(ids.tpab, '2026-10-04T12:00:00.000Z', 4500);
  await play(ids.untagged, '2026-10-05T12:00:00.000Z', 600);
});

const SEP_AND_OCT = { from: '2026-09-01T00:00:00.000Z', to: '2026-11-01T00:00:00.000Z' };

describe('GET /api/stats', () => {
  it('adds up the totals', async () => {
    expect((await stats()).totals).toEqual({
      spinCount: 5,
      listeningSeconds: 12000,
      recordCount: 4,
      artistCount: 5,
    });
  });

  it('ranks artists by listening time, crediting every artist on a record', async () => {
    const { topArtists } = await stats();

    expect(topArtists.map((a) => [a.name, a.listeningSeconds, a.spinCount])).toEqual([
      ['Kendrick Lamar', 4500, 1],
      ['Miles Davis', 3900, 2],
      // A tie: alphabetical order.
      ['Nico', 3000, 1],
      ['The Velvet Underground', 3000, 1],
      ['Someone', 600, 1],
    ]);
  });

  it('ranks records by listening time', async () => {
    const { topRecords } = await stats();

    expect(topRecords.map((r) => [r.record.title, r.listeningSeconds, r.spinCount])).toEqual([
      ['To Pimp a Butterfly', 4500, 1],
      ['Kind of Blue', 3900, 2],
      ['The Velvet Underground & Nico', 3000, 1],
      ['Untagged', 600, 1],
    ]);
  });

  it('splits a record’s time between its genres, month by month', async () => {
    const { genresByMonth } = await stats(SEP_AND_OCT);

    expect(genresByMonth.months).toEqual(['2026-09', '2026-10']);
    expect(genresByMonth.genres).toEqual([
      { name: 'Jazz', seconds: [2700, 2700] }, // 1200 + half... a third of 4500
      { name: 'Rock', seconds: [0, 3000] },
      { name: 'Funk / Soul', seconds: [0, 1500] },
      { name: 'Hip Hop', seconds: [0, 1500] },
      { name: 'No genre', seconds: [0, 600] },
    ]);
    // Each month still adds up to the real listening time.
    const october = genresByMonth.genres.reduce((sum, g) => sum + (g.seconds[1] ?? 0), 0);
    expect(october).toBe(1200 + 3000 + 4500 + 600);
  });

  it('folds genres past the top 5 into "Other"', async () => {
    const folk = await addRecord({ title: 'Blue', artists: ['Joni Mitchell'], genres: ['Folk'] });
    await play(folk, '2026-10-06T12:00:00.000Z', 300);

    const { genres } = (await stats(SEP_AND_OCT)).genresByMonth;

    expect(genres.map((g) => g.name)).toEqual([
      'Jazz',
      'Rock',
      'Funk / Soul',
      'Hip Hop',
      'No genre',
      'Other',
    ]);
    expect(genres.at(-1)?.seconds).toEqual([0, 300]);
  });

  it('only counts plays inside the chosen period', async () => {
    const october = await stats({ from: '2026-10-01T00:00:00.000Z' });

    expect(october.totals.spinCount).toBe(4);
    expect(october.topArtists.find((a) => a.name === 'Miles Davis')?.listeningSeconds).toBe(1200);
  });

  it('puts late-night plays in the right month for the viewer’s time zone', async () => {
    // 2 AM UTC on Oct 1 is 10 PM on Sep 30 in New York (UTC-4).
    ctx = makeTestApp();
    const id = await addRecord({ genres: ['Jazz'] });
    await play(id, '2026-10-01T02:00:00.000Z', 600);

    const utc = await stats({ ...SEP_AND_OCT, utcOffsetMinutes: 0 });
    // The website sends the viewer's own midnights: midnight in New York is 4 AM UTC.
    const newYork = await stats({
      from: '2026-09-01T04:00:00.000Z',
      to: '2026-11-01T04:00:00.000Z',
      utcOffsetMinutes: -240,
    });

    expect(utc.genresByMonth.genres[0]?.seconds).toEqual([0, 600]);
    expect(newYork.genresByMonth.genres[0]?.seconds).toEqual([600, 0]);
  });

  it('returns empty stats when nothing was played', async () => {
    const empty = await stats({ from: '2030-01-01T00:00:00.000Z' });

    expect(empty).toEqual({
      totals: { spinCount: 0, listeningSeconds: 0, recordCount: 0, artistCount: 0 },
      topArtists: [],
      topRecords: [],
      genresByMonth: { months: [], genres: [] },
    });
  });

  it('rejects a time zone that does not exist', async () => {
    const res = await ctx.api.get('/api/stats').query({ utcOffsetMinutes: 5000 });
    expect(res.status).toBe(400);
  });
});

describe('monthsBetween', () => {
  it('lists every month, across the new year', () => {
    expect(monthsBetween('2026-11', '2027-02')).toEqual([
      '2026-11',
      '2026-12',
      '2027-01',
      '2027-02',
    ]);
    expect(monthsBetween('2026-10', '2026-10')).toEqual(['2026-10']);
  });
});
