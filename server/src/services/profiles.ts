// ============================================================================
// profiles.ts (service): PUBLIC PROFILE PAGES
//
//   getProfile        /u/username: shelf, most-played, recent plays, years
//   getYearInRecords  /u/username/year/2026: one year's recap
//
// A profile is private until its owner turns on "profilePublic" in settings.
// A private profile answers "not found" to everyone else, exactly like a
// username that doesn't exist, so nobody can tell which accounts exist.
// The owner can always see their own page (as a preview).
//
// Everything is built from the same services as the private pages, then
// copied field by field into what's safe to share: ratings and reviews are,
// notes and conditions are not.
// ============================================================================

import { and, eq, gte, inArray, lt } from 'drizzle-orm';
import type { Profile, User, VinylRecord, YearInRecords } from '@vinyl/shared';
import type { Db } from '../db/client.js';
import { records, spins } from '../db/schema.js';
import { AppError } from '../errors.js';
import { findUserByUsername } from './auth.js';
import { listRecords } from './records.js';
import { getSettings } from './settings.js';
import { listSpins } from './spins.js';
import { getStats, localMonth, monthsBetween } from './stats.js';

const RECENT_PLAYS = 8;
const HIGHEST_RATED = 6;
const REVIEWS = 10;

/** The few details of a record shown next to a play, a rating or a review. */
const summary = ({ id, title, artists, coverImageUrl }: VinylRecord) => ({
  id,
  title,
  artists,
  coverImageUrl,
});

/** Best rating first; ties in alphabetical order. Unrated records are left out. */
function byRating(owned: VinylRecord[]) {
  return owned
    .flatMap((r) => (r.rating === null ? [] : [{ record: summary(r), rating: r.rating }]))
    .sort((a, b) => b.rating - a.rating || a.record.title.localeCompare(b.record.title));
}

/** The profile's owner, if the viewer is allowed to see it. */
function visibleProfile(db: Db, username: string, viewer: User | null | undefined) {
  const owner = findUserByUsername(db, username);
  const isPublic = owner ? getSettings(db, owner.id).profilePublic : false;
  const isOwner = Boolean(owner && viewer?.id === owner.id);
  if (!owner || (!isPublic && !isOwner)) {
    throw new AppError(404, 'PROFILE_NOT_FOUND', 'There is no public profile with that name.');
  }
  return {
    owner,
    user: {
      username: owner.username,
      displayName: owner.displayName,
      memberSince: owner.createdAt,
    },
    isPublic,
    isOwner,
  };
}

export function getProfile(
  db: Db,
  username: string,
  viewer: User | null | undefined,
  { utcOffsetMinutes }: { utcOffsetMinutes: number },
): Profile {
  const { owner, ...who } = visibleProfile(db, username, viewer);
  const stats = getStats(db, owner.id, { utcOffsetMinutes });

  const owned = listRecords(db, owner.id, { sort: 'artist' });
  const shelf = owned.map((r) => ({
    ...summary(r),
    year: r.year,
    spinCount: r.spinCount,
    rating: r.rating,
  }));

  const reviews = owned
    .flatMap((r) =>
      r.review === null
        ? []
        : [
            {
              record: summary(r),
              rating: r.rating,
              review: r.review,
              reviewedAt: r.reviewedAt ?? r.updatedAt,
            },
          ],
    )
    .sort((a, b) => b.reviewedAt.localeCompare(a.reviewedAt))
    .slice(0, REVIEWS);

  const recentPlays = listSpins(db, owner.id, { limit: RECENT_PLAYS }).map((spin) => ({
    playedAt: spin.playedAt,
    durationSeconds: spin.durationSeconds,
    sides: spin.sides,
    rating: spin.rating,
    record: spin.record,
  }));

  return {
    ...who,
    totals: {
      recordCount: shelf.length,
      spinCount: stats.totals.spinCount,
      listeningSeconds: stats.totals.listeningSeconds,
    },
    topRecords: stats.topRecords,
    topArtists: stats.topArtists,
    recentPlays,
    highestRated: byRating(owned).slice(0, HIGHEST_RATED),
    reviews,
    shelf,
    years: yearsWithPlays(db, owner.id, utcOffsetMinutes),
  };
}

export function getYearInRecords(
  db: Db,
  username: string,
  year: number,
  viewer: User | null | undefined,
  { utcOffsetMinutes }: { utcOffsetMinutes: number },
): YearInRecords {
  const { owner, ...who } = visibleProfile(db, username, viewer);

  // January 1st to the next January 1st, in the viewer's time zone.
  const startOf = (y: number) => new Date(Date.UTC(y, 0, 1) - utcOffsetMinutes * 60_000);
  const from = startOf(year).toISOString();
  const to = startOf(year + 1).toISOString();
  const stats = getStats(db, owner.id, { from, to, utcOffsetMinutes });

  // getStats gives listening time per genre per month; adding up a month's
  // genres gives that month's total, and adding up a genre's months its total.
  const { months: statMonths, genres } = stats.genresByMonth;
  const months = monthsBetween(`${year}-01`, `${year}-12`).map((month) => {
    const i = statMonths.indexOf(month);
    const listeningSeconds = i === -1 ? 0 : genres.reduce((sum, g) => sum + (g.seconds[i] ?? 0), 0);
    return { month, listeningSeconds };
  });
  const topGenres = genres.map((g) => ({
    name: g.name,
    listeningSeconds: g.seconds.reduce((sum, s) => sum + s, 0),
  }));

  const addedCount = db
    .select({ addedAt: records.addedAt })
    .from(records)
    .where(eq(records.userId, owner.id))
    .all()
    .filter((r) => r.addedAt >= from && r.addedAt < to).length;

  // The best-rated record among the ones played this year.
  const playedIds = db
    .selectDistinct({ recordId: spins.recordId })
    .from(spins)
    .where(and(gte(spins.playedAt, from), lt(spins.playedAt, to)))
    .all()
    .map((s) => s.recordId);
  const played = listRecords(db, owner.id, { sort: 'artist' }).filter((r) =>
    playedIds.includes(r.id),
  );

  return {
    ...who,
    year,
    totals: stats.totals,
    topRecords: stats.topRecords,
    topArtists: stats.topArtists,
    months,
    topGenres,
    addedCount,
    highestRated: byRating(played)[0] ?? null,
  };
}

/** Every year (in the viewer's time zone) with at least one play, newest first. */
function yearsWithPlays(db: Db, userId: number, utcOffsetMinutes: number): number[] {
  const ownRecords = db.select({ id: records.id }).from(records).where(eq(records.userId, userId));
  const years = db
    .select({ playedAt: spins.playedAt })
    .from(spins)
    .where(inArray(spins.recordId, ownRecords))
    .all()
    .map((s) => Number(localMonth(s.playedAt, utcOffsetMinutes).slice(0, 4)));
  return [...new Set(years)].sort((a, b) => b - a);
}
