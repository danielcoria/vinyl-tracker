// ============================================================================
// demo.ts: FILLS AN EMPTY DATABASE WITH DEMO DATA (for the online demo)
//
// The public demo runs on a free host whose files are wiped whenever it
// restarts, so on every start (with DEMO_MODE=true) it fills itself again:
//   - 14 well-known albums with real Discogs covers and tracklists
//     (saved once with scripts/fetch-demo-data.mjs into demo-releases.json)
//   - about 6 months of plays, timed relative to "now" so the demo always
//     looks recent: some favorites, two albums gathering dust, two never played
//   - a stylus at about 70% of its rated hours
// The "random" choices come from a fixed seed, so the demo looks the same
// every time it starts.
//
// Everything belongs to a special "demo" account. It has no usable password:
// visitors get in with the "Try the demo" button (POST /api/auth/demo).
// ============================================================================

import { count, eq, sql } from 'drizzle-orm';
import {
  recordInputSchema,
  spinInputSchema,
  stylusInputSchema,
  type Condition,
} from '@vinyl/shared';
import { releaseToRecordInput, releaseToTracks } from '../integrations/discogs/mapping.js';
import { rawReleaseSchema } from '../integrations/discogs/schemas.js';
import { createRecord } from '../services/records.js';
import { updateSettings } from '../services/settings.js';
import { createSpin } from '../services/spins.js';
import { addStylus } from '../services/styluses.js';
import { getTracks, replaceTracks } from '../services/tracks.js';
import type { Db } from './client.js';
import demoReleases from './demo-releases.json';
import { records, users } from './schema.js';

export const DEMO_USERNAME = 'demo';

/** The demo account, created if it doesn't exist yet. */
export function demoUserId(db: Db): number {
  const existing = db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.username}) = ${DEMO_USERNAME}`)
    .get();
  if (existing) return existing.id;
  return db
    .insert(users)
    .values({
      username: DEMO_USERNAME,
      displayName: 'Demo Listener',
      // Not a real password hash, so no password can ever match it.
      passwordHash: 'no-password:demo-account',
    })
    .returning({ id: users.id })
    .get().id;
}

const DAY = 24 * 60 * 60 * 1000;

/**
 * How each album is played in the demo, matched by title. Not listed = never played.
 * `plays`: how many plays in the last ~6 months. `lastPlayedDaysAgo`: when the most
 * recent one was (older than 90 days = "gathering dust"). `rating` and `review`:
 * the demo listener's stars and write-up for the album.
 */
type Plan = { plays: number; lastPlayedDaysAgo?: number; rating?: number; review?: string };
const LISTENING: Record<string, Plan> = {
  'kind of blue': {
    plays: 9,
    rating: 5,
    review:
      "The record I put on when I can't decide what to put on. Side A is perfect late at night with the lights low.",
  },
  'to pimp a butterfly': {
    plays: 7,
    rating: 5,
    review:
      'Four sides and not a wasted minute. Sounds huge on vinyl; the bass on side B shakes the shelf.',
  },
  rumours: { plays: 6, rating: 4.5 },
  'back to black': {
    plays: 6,
    rating: 4.5,
    review: 'Short enough to play twice in a row, and I usually do.',
  },
  'ok computer': { plays: 5, rating: 4 },
  blue: {
    plays: 5,
    rating: 4.5,
    review: 'A quiet Sunday-morning record. My copy crackles a little and I like it that way.',
  },
  "what's going on": { plays: 4, rating: 5 },
  'the dark side of the moon': { plays: 4, rating: 4 },
  discovery: { plays: 4, rating: 3.5 },
  'a love supreme': { plays: 3, rating: 4.5 },
  'purple rain': { plays: 2, lastPlayedDaysAgo: 130, rating: 4 },
  nevermind: {
    plays: 2,
    lastPlayedDaysAgo: 210,
    rating: 3,
    review: 'Loved it at sixteen. These days it mostly gathers dust, but side A still holds up.',
  },
};

const CONDITIONS: Condition[][] = [
  ['NM', 'VG+'],
  ['VG+', 'VG+'],
  ['M', 'M'],
  ['VG+', 'VG'],
  ['VG', 'G+'],
];

/** A small seeded random-number generator ("mulberry32"): same seed, same numbers. */
function seededRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Adds the demo data if the collection is empty. Returns what was added. */
export function seedDemoData(db: Db, now: number = Date.now()) {
  const userId = demoUserId(db);
  // Its profile page is public, so visitors can see what one looks like (/u/demo).
  updateSettings(db, userId, { profilePublic: true });
  const existing =
    db.select({ n: count() }).from(records).where(eq(records.userId, userId)).get()?.n ?? 0;
  if (existing > 0) return { userId, records: 0, spins: 0 };

  // The records were collected over the past two years, so the account "joined" then
  // (the profile says "Collecting since ...").
  const joinedAt = new Date(now - 730 * DAY).toISOString();
  db.update(users).set({ createdAt: joinedAt }).where(eq(users.id, userId)).run();

  const random = seededRandom(1971);
  let spinCount = 0;
  let playedSeconds = 0;

  demoReleases.forEach((raw, index) => {
    const release = rawReleaseSchema.parse(raw);
    const [mediaCondition, sleeveCondition] = CONDITIONS[index % CONDITIONS.length] ?? [];
    const record = createRecord(
      db,
      userId,
      recordInputSchema.parse({
        ...releaseToRecordInput(release),
        mediaCondition,
        sleeveCondition,
      }),
      { discogsReleaseId: release.id },
    );
    replaceTracks(db, record.id, releaseToTracks(release));
    // Added to the collection at different times over the past two years.
    const addedAt = new Date(now - (720 - index * 45) * DAY).toISOString();
    db.update(records).set({ addedAt, updatedAt: addedAt }).where(eq(records.id, record.id)).run();

    const plan = LISTENING[record.title.toLowerCase()];
    if (!plan) return; // never played

    if (plan.rating) {
      // Reviewed a month after it was added to the shelf.
      const reviewedAt = new Date(Date.parse(addedAt) + 30 * DAY).toISOString();
      db.update(records)
        .set({ rating: plan.rating, review: plan.review ?? null, reviewedAt })
        .where(eq(records.id, record.id))
        .run();
    }

    const sides = [...new Set(getTracks(db, record.id).flatMap((t) => (t.side ? [t.side] : [])))];
    for (let i = 0; i < plan.plays; i++) {
      // The most recent play is `lastPlayedDaysAgo` (or within the last week);
      // the others are spread over the months before it.
      const newest = plan.lastPlayedDaysAgo ?? Math.floor(random() * 7) + 1;
      const daysAgo =
        i === 0 ? newest : newest + Math.floor(random() * (175 - Math.min(newest, 150)));
      const evening = 18 + random() * 5; // between 6 and 11 PM (UTC)
      const day = new Date(now - daysAgo * DAY);
      day.setUTCHours(Math.floor(evening), Math.floor((evening % 1) * 60), 0, 0);

      // Mostly whole albums; sometimes just one side.
      const oneSide =
        sides.length > 1 && random() < 0.35 ? sides[Math.floor(random() * sides.length)] : null;
      const tracks = getTracks(db, record.id).filter((t) => !oneSide || t.side === oneSide);
      const durationSeconds =
        tracks.reduce((sum, t) => sum + (t.durationSeconds ?? 0), 0) ||
        record.runtimeSeconds ||
        2400;

      createSpin(
        db,
        userId,
        spinInputSchema.parse({
          recordId: record.id,
          playedAt: day.toISOString(),
          sides: oneSide ? [oneSide] : null,
          durationSeconds,
          // Every other listen is rated: around the album's rating, a bit up or down.
          rating:
            plan.rating && i % 2 === 0
              ? Math.min(5, Math.max(0.5, plan.rating + ([0, -0.5, 0.5][(i / 2) % 3] ?? 0)))
              : null,
        }),
      );
      spinCount += 1;
      playedSeconds += durationSeconds;
    }
  });

  // An elliptical stylus at about 70% of its 800 rated hours, counting the plays above.
  const ratedHours = 800;
  addStylus(
    db,
    userId,
    stylusInputSchema.parse({
      name: 'Audio-Technica VM540ML',
      ratedHours,
      initialHours: Math.max(0, Math.round(ratedHours * 0.7 - playedSeconds / 3600)),
      installedAt: new Date(now - 400 * DAY).toISOString(),
    }),
  );

  return { userId, records: demoReleases.length, spins: spinCount };
}
