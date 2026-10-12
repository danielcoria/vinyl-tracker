// ============================================================================
// suggestions.ts (service): "WHAT SHOULD I PLAY TONIGHT?"
//
// Picks up to three records from a person's own shelf. For each record:
//
//   1. Does it match the genre asked for? If not, it's out.
//   2. Does it fit the time? The whole record if it fits; otherwise the
//      longest run of sides in a row that does (side A, or sides C+D...).
//      If nothing fits, it's out.
//   3. Give it a score from three things, each between 0 and 1:
//        dust    how long since it was last played (6 months or more = 1;
//                never played = 1)
//        rating  its stars out of 5 (unrated counts as a middling 0.6)
//        fit     how much of the available time it fills
//      The "mood" decides how much dust and rating count. A record played in
//      the last two days is pushed to the bottom, so suggestions feel fresh.
//
// Then the best three are taken, skipping a second record by the same artist
// when there are other choices. Nothing is random: the same shelf and the
// same question always give the same answer ("Shuffle" asks again, leaving
// out the ones already shown).
// ============================================================================

import type {
  ParsedSuggestionQuery,
  Suggestion,
  SuggestionMood,
  Suggestions,
  Track,
  VinylRecord,
} from '@vinyl/shared';
import { SUGGESTION_COUNT } from '@vinyl/shared';
import type { Db } from '../db/client.js';
import { listRecords } from './records.js';
import { getTracks } from './tracks.js';

const DAY_MS = 24 * 60 * 60 * 1000;
/** After this long without a play, a record is as "dusty" as it gets. */
const FULL_DUST_DAYS = 180;
/** Played this recently = suggested last. */
const JUST_PLAYED_DAYS = 2;
const UNRATED_SCORE = 0.6;

/** How much dust and rating count for each mood (they add up to 1). */
const WEIGHTS: Record<SuggestionMood, { dust: number; rating: number }> = {
  any: { dust: 0.5, rating: 0.5 },
  favorites: { dust: 0.15, rating: 0.85 },
  neglected: { dust: 0.85, rating: 0.15 },
};

export function getSuggestions(
  db: Db,
  userId: number,
  query: ParsedSuggestionQuery,
  /** The current time. Tests pass a fixed one. */
  now: number = Date.now(),
): Suggestions {
  const shelf = listRecords(db, userId, { sort: 'added' });
  const wantedGenre = query.genre?.toLowerCase();
  const limitSeconds = query.minutes === undefined ? null : query.minutes * 60;

  const matches = shelf.flatMap((record) => {
    if (wantedGenre && !record.genres.some((g) => g.toLowerCase() === wantedGenre)) return [];
    const fit = whatFits(record, getTracks(db, record.id), limitSeconds);
    if (!fit) return [];

    const daysSince = Math.max(
      0,
      Math.floor((now - Date.parse(record.lastPlayedAt ?? record.addedAt)) / DAY_MS),
    );
    const dust = record.lastPlayedAt === null ? 1 : Math.min(daysSince / FULL_DUST_DAYS, 1);
    const rating = record.rating === null ? UNRATED_SCORE : record.rating / 5;
    const weights = WEIGHTS[query.mood];
    // Filling the time well is a small bonus, never enough to beat a much better pick.
    const fill =
      limitSeconds && fit.durationSeconds ? (fit.durationSeconds / limitSeconds) * 0.2 : 0;
    const justPlayed = record.lastPlayedAt !== null && daysSince < JUST_PLAYED_DAYS;
    const score = weights.dust * dust + weights.rating * rating + fill - (justPlayed ? 2 : 0);

    return [{ record, score, daysSince, ...fit }];
  });

  const ranked = matches
    .filter((m) => !query.exclude.includes(m.record.id))
    .sort((a, b) => b.score - a.score || a.record.title.localeCompare(b.record.title));

  // Take the best three, but not two by the same artist while others are waiting.
  const picked: typeof ranked = [];
  const artistOf = (r: VinylRecord) => r.artists[0]?.id;
  for (const match of ranked) {
    if (picked.length === SUGGESTION_COUNT) break;
    if (picked.some((p) => artistOf(p.record) === artistOf(match.record))) continue;
    picked.push(match);
  }
  for (const match of ranked) {
    if (picked.length === SUGGESTION_COUNT) break;
    if (!picked.includes(match)) picked.push(match);
  }
  picked.sort((a, b) => b.score - a.score);

  return {
    suggestions: picked.map(({ record, daysSince, sides, durationSeconds }): Suggestion => ({
      record: {
        id: record.id,
        title: record.title,
        artists: record.artists,
        coverImageUrl: record.coverImageUrl,
      },
      year: record.year,
      genres: record.genres,
      rating: record.rating,
      spinCount: record.spinCount,
      lastPlayedAt: record.lastPlayedAt,
      daysSince,
      sides,
      durationSeconds,
    })),
    matchCount: matches.length,
    genres: genresByCount(shelf),
  };
}

type Fit = { sides: string[] | null; durationSeconds: number | null };

/**
 * What to put on in the time available: the whole record (sides: null), or the
 * longest run of sides in a row that fits. null = nothing fits.
 * Without a time limit, it's always the whole record.
 */
export function whatFits(
  record: Pick<VinylRecord, 'runtimeSeconds'>,
  tracks: Track[],
  limitSeconds: number | null,
): Fit | null {
  const sides = sideLengths(tracks);
  const sidesTotal = sides && sides.reduce((sum, s) => sum + s.seconds, 0);
  const whole = sidesTotal || record.runtimeSeconds;

  if (limitSeconds === null) return { sides: null, durationSeconds: whole };
  if (whole === null) return null; // no idea how long it is
  if (whole <= limitSeconds) return { sides: null, durationSeconds: whole };
  if (!sides) return null;

  // Try every run of sides in a row (A, A+B, B, B+C...) and keep the longest that fits.
  let best: { start: number; end: number; seconds: number } | null = null;
  for (let start = 0; start < sides.length; start++) {
    let seconds = 0;
    for (let end = start; end < sides.length; end++) {
      seconds += sides[end]?.seconds ?? 0;
      if (seconds > limitSeconds) break;
      if (!best || seconds > best.seconds) best = { start, end, seconds };
    }
  }
  if (!best) return null;
  return {
    sides: sides.slice(best.start, best.end + 1).map((s) => s.side),
    durationSeconds: best.seconds,
  };
}

/** Each side's length, in record order. null unless every track has a side and a length. */
function sideLengths(tracks: Track[]): { side: string; seconds: number }[] | null {
  if (tracks.length === 0) return null;
  const sides: { side: string; seconds: number }[] = [];
  for (const track of tracks) {
    if (track.side === null || track.durationSeconds === null) return null;
    const last = sides.at(-1);
    if (last?.side === track.side) last.seconds += track.durationSeconds;
    else sides.push({ side: track.side, seconds: track.durationSeconds });
  }
  return sides;
}

/** Every genre on the shelf, the most common first (then alphabetical). */
function genresByCount(shelf: VinylRecord[]): string[] {
  const counts = new Map<string, number>();
  for (const record of shelf) {
    for (const genre of record.genres) counts.set(genre, (counts.get(genre) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([a, countA], [b, countB]) => countB - countA || a.localeCompare(b))
    .map(([genre]) => genre);
}
