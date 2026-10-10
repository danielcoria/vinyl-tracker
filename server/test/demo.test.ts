// ============================================================================
// demo.test.ts: TESTS FOR THE DEMO DATA
//
// Checks the public demo fills itself in so every page has something to show,
// the same way every time, and never touches a database that already has data.
// ============================================================================

import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { healthResponseSchema } from '@vinyl/shared';
import { createApp } from '../src/app.js';
import { createDb } from '../src/db/client.js';
import { seedDemoData } from '../src/db/demo.js';
import { getDustReport } from '../src/services/dust.js';
import { listRecords } from '../src/services/records.js';
import { listSpins } from '../src/services/spins.js';
import { getStats } from '../src/services/stats.js';
import { listStyluses } from '../src/services/styluses.js';
import { getTracks } from '../src/services/tracks.js';

const NOW = Date.parse('2026-10-09T12:00:00.000Z');

function seeded() {
  const db = createDb(':memory:');
  const result = seedDemoData(db, NOW);
  return { db, result };
}

describe('seedDemoData', () => {
  it('adds 14 albums with real covers, tracklists and sides', () => {
    const { db, result } = seeded();

    expect(result.records).toBe(14);
    const collection = listRecords(db, { sort: 'added' });
    expect(collection).toHaveLength(14);
    for (const record of collection) {
      expect(record.coverImageUrl).toMatch(/^https:\/\/i\.discogs\.com\//);
      expect(record.discogsReleaseId).not.toBeNull();
      expect(record.runtimeSeconds).toBeGreaterThan(0);
      expect(getTracks(db, record.id).some((t) => t.side === 'A')).toBe(true);
    }
  });

  it('adds months of plays, with recent favorites', () => {
    const { db, result } = seeded();

    expect(result.spins).toBeGreaterThanOrEqual(50);
    const spins = listSpins(db, { limit: 200 });
    expect(spins).toHaveLength(result.spins);
    // All in the past, and the most recent within the last week.
    expect(spins.every((s) => Date.parse(s.playedAt) < NOW)).toBe(true);
    expect(NOW - Date.parse(spins[0]?.playedAt ?? '')).toBeLessThan(8 * 24 * 60 * 60 * 1000);

    const stats = getStats(db, { utcOffsetMinutes: 0, to: new Date(NOW).toISOString() });
    // Ranked by listening TIME: a 79-minute double album played 7 times beats
    // a 45-minute album played 9 times, even though Kind of Blue has more plays.
    expect(stats.topRecords[0]?.record.title).toBe('To Pimp A Butterfly');
    const kindOfBlue = stats.topRecords.find((r) => r.record.title === 'Kind Of Blue');
    expect(kindOfBlue?.spinCount).toBe(9);
    expect(Math.max(...stats.topRecords.map((r) => r.spinCount))).toBe(9);
    expect(stats.genresByMonth.genres.length).toBeGreaterThan(2);
  });

  it('gives the dust report something to show', () => {
    const { db } = seeded();

    const report = getDustReport(db, {}, NOW);

    expect(report.dusty.map((d) => d.record.title)).toEqual(['Nevermind', 'Purple Rain']);
    expect(report.neverPlayed.map((d) => d.record.title).sort()).toEqual([
      'Abbey Road',
      'Random Access Memories',
    ]);
    // Added at different times, not all "today".
    expect(new Set(report.neverPlayed.map((d) => d.days)).size).toBe(2);
  });

  it('installs a stylus at about 70% of its rated hours', () => {
    const { db } = seeded();

    const [stylus] = listStyluses(db);
    expect(stylus?.retiredAt).toBeNull();
    expect(stylus?.percentUsed).toBeGreaterThanOrEqual(69);
    expect(stylus?.percentUsed).toBeLessThanOrEqual(71);
    expect(stylus?.status).toBe('ok');
  });

  it('comes out exactly the same every time', () => {
    const plays = (db: ReturnType<typeof createDb>) =>
      listSpins(db, { limit: 200 }).map((s) => [
        s.record.title,
        s.playedAt,
        s.sides,
        s.durationSeconds,
      ]);

    expect(plays(seeded().db)).toEqual(plays(seeded().db));
  });

  it('leaves a database that already has records alone', () => {
    const { db } = seeded();

    expect(seedDemoData(db, NOW)).toEqual({ records: 0, spins: 0 });
    expect(listRecords(db, { sort: 'added' })).toHaveLength(14);
  });
});

describe('health check', () => {
  it('tells the website whether this is the demo', async () => {
    const demo = createApp({ db: createDb(':memory:'), demo: true });
    const normal = createApp({ db: createDb(':memory:') });

    expect(healthResponseSchema.parse((await request(demo).get('/api/health')).body).demo).toBe(
      true,
    );
    expect(healthResponseSchema.parse((await request(normal).get('/api/health')).body).demo).toBe(
      false,
    );
  });
});
