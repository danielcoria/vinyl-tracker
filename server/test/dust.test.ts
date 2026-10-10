// ============================================================================
// dust.test.ts: TESTS FOR THE DUST REPORT AND SETTINGS
//
// The service tests use a fixed "now" (Oct 8, 2026, noon UTC), so day counts
// are exact. The route tests use real time, like the app does.
// ============================================================================

import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { apiErrorSchema, dustReportSchema, type RecordInput } from '@vinyl/shared';
import { records, spins } from '../src/db/schema.js';
import { getDustReport } from '../src/services/dust.js';
import { getSettings, updateSettings } from '../src/services/settings.js';
import { userSettings } from '../src/db/schema.js';
import { makeTestApp, recordInput } from './helpers.js';

const NOW = Date.parse('2026-10-08T12:00:00.000Z');
const daysAgo = (days: number) => new Date(NOW - days * 24 * 60 * 60 * 1000).toISOString();

let ctx: ReturnType<typeof makeTestApp>;

/** Adds a record, "added" `addedDaysAgo` days ago, with plays `playedDaysAgo` days ago. */
async function addRecord(
  title: string,
  { addedDaysAgo = 400, playedDaysAgo = [] as number[] } = {},
  overrides: Partial<RecordInput> = {},
) {
  const res = await ctx.api.post('/api/records').send(recordInput({ title, ...overrides }));
  const id: number = res.body.id;
  ctx.db
    .update(records)
    .set({ addedAt: daysAgo(addedDaysAgo) })
    .where(eq(records.id, id))
    .run();
  for (const days of playedDaysAgo) {
    ctx.db
      .insert(spins)
      .values({ recordId: id, playedAt: daysAgo(days), durationSeconds: 1200 })
      .run();
  }
  return id;
}

beforeEach(() => {
  ctx = makeTestApp();
});

describe('getDustReport', () => {
  beforeEach(async () => {
    await addRecord('Played yesterday', { playedDaysAgo: [1] });
    await addRecord('Played 100 days ago', { playedDaysAgo: [100] });
    await addRecord('Played 300 days ago, then 120', { playedDaysAgo: [300, 120] });
    await addRecord('Never played, old', { addedDaysAgo: 200 });
    await addRecord('Never played, new', { addedDaysAgo: 3 });
  });

  it('lists records not played in 90 days, longest-forgotten first', () => {
    const report = getDustReport(ctx.db, ctx.user.id, {}, NOW);

    expect(report.thresholdDays).toBe(90);
    expect(report.collectionCount).toBe(5);
    expect(report.dusty.map((d) => [d.record.title, d.days, d.spinCount])).toEqual([
      // Only the LAST play counts: 120 days, not 300.
      ['Played 300 days ago, then 120', 120, 2],
      ['Played 100 days ago', 100, 1],
    ]);
  });

  it('lists never-played records, longest-owned first', () => {
    const report = getDustReport(ctx.db, ctx.user.id, {}, NOW);

    expect(report.neverPlayed.map((d) => [d.record.title, d.days, d.lastPlayedAt])).toEqual([
      ['Never played, old', 200, null],
      ['Never played, new', 3, null],
    ]);
  });

  it('uses a different number of days when asked', () => {
    expect(getDustReport(ctx.db, ctx.user.id, { days: 110 }, NOW).dusty).toHaveLength(1);
    // "Yesterday" is exactly 1 day ago, which isn't MORE than 1 day, so it isn't dusty.
    expect(getDustReport(ctx.db, ctx.user.id, { days: 1 }, NOW).dusty).toHaveLength(2);
  });

  it('uses the saved threshold', () => {
    updateSettings(ctx.db, ctx.user.id, { dustThresholdDays: 30 });

    const report = getDustReport(ctx.db, ctx.user.id, {}, NOW);
    expect(report.thresholdDays).toBe(30);
    expect(report.dusty).toHaveLength(2);
  });

  it('counts a record played exactly at the threshold as not dusty yet', async () => {
    await addRecord('Played exactly 90 days ago', { playedDaysAgo: [90] });

    const titles = getDustReport(ctx.db, ctx.user.id, {}, NOW).dusty.map((d) => d.record.title);
    expect(titles).not.toContain('Played exactly 90 days ago');
  });
});

describe('settings', () => {
  it('starts with the defaults', () => {
    expect(getSettings(ctx.db, ctx.user.id)).toEqual({ dustThresholdDays: 90 });
  });

  it('falls back to the default when a saved value is broken', () => {
    ctx.db
      .insert(userSettings)
      .values({ userId: ctx.user.id, key: 'dustThresholdDays', value: '"lots"' })
      .run();
    expect(getSettings(ctx.db, ctx.user.id).dustThresholdDays).toBe(90);
  });

  it('saves changes through the API', async () => {
    const res = await ctx.api.put('/api/settings').send({ dustThresholdDays: 60 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ dustThresholdDays: 60 });
    expect((await ctx.api.get('/api/settings')).body).toEqual({ dustThresholdDays: 60 });
  });

  it('rejects values out of range', async () => {
    const res = await ctx.api.put('/api/settings').send({ dustThresholdDays: 2 });

    expect(res.status).toBe(400);
    expect(apiErrorSchema.parse(res.body).error.message).toBe(
      'dustThresholdDays: Pick at least 7 days',
    );
  });
});

describe('GET /api/dust', () => {
  it('returns the report using real time', async () => {
    const id = (await ctx.api.post('/api/records').send(recordInput())).body.id;

    const res = await ctx.api.get('/api/dust').query({ days: 30 });

    expect(res.status).toBe(200);
    const report = dustReportSchema.parse(res.body);
    expect(report.thresholdDays).toBe(30);
    expect(report.neverPlayed.map((d) => d.record.id)).toEqual([id]);
    expect(report.neverPlayed[0]?.days).toBe(0);
  });

  it('rejects a nonsense number of days', async () => {
    expect((await ctx.api.get('/api/dust').query({ days: 0 })).status).toBe(400);
  });
});
