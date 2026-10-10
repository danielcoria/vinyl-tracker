// ============================================================================
// stats.ts (service): NUMBERS FOR THE STATS PAGE
//
// Reads every play in the chosen period and adds things up:
//   totals          plays, hours, how many different records and artists
//   topArtists      most-listened artists (a record by two artists counts for both)
//   topRecords      most-listened records
//   genresByMonth   listening time per genre per month. A record with two
//                   genres splits its time between them, so each month's
//                   total still equals the real listening time.
//
// The adding-up happens in TypeScript rather than SQL: one person's diary is
// small, and this way each step is easy to read and test.
// ============================================================================

import { and, asc, eq, gte, inArray, lt, type SQL } from 'drizzle-orm';
import type { Stats } from '@vinyl/shared';
import type { Db } from '../db/client.js';
import { records, spins } from '../db/schema.js';
import { getRecordsByIds } from './records.js';

const TOP_COUNT = 10;
const GENRE_COUNT = 5;
/** Longer histories show the most recent 24 months, so the chart stays readable. */
const MAX_MONTHS = 24;
const OTHER = 'Other';
const NO_GENRE = 'No genre';

type Totals = { spinCount: number; listeningSeconds: number };

export function getStats(
  db: Db,
  userId: number,
  query: { from?: string; to?: string; utcOffsetMinutes: number },
): Stats {
  // Only this person's plays: plays of records they own.
  const ownRecords = db.select({ id: records.id }).from(records).where(eq(records.userId, userId));
  const conditions: SQL[] = [inArray(spins.recordId, ownRecords)];
  if (query.from) conditions.push(gte(spins.playedAt, new Date(query.from).toISOString()));
  if (query.to) conditions.push(lt(spins.playedAt, new Date(query.to).toISOString()));
  const plays = db
    .select()
    .from(spins)
    .where(and(...conditions))
    .orderBy(asc(spins.playedAt))
    .all();

  const recordsById = new Map(
    getRecordsByIds(db, userId, [...new Set(plays.map((p) => p.recordId))]).map((r) => [r.id, r]),
  );

  const byArtist = new Map<number, Totals & { name: string }>();
  const byRecord = new Map<number, Totals>();
  const monthKey = (iso: string) => localMonth(iso, query.utcOffsetMinutes);
  // genre -> month -> seconds (kept as decimals until the end, then rounded)
  const genreMonths = new Map<string, Map<string, number>>();
  let listeningSeconds = 0;

  for (const play of plays) {
    const record = recordsById.get(play.recordId);
    if (!record) continue;
    listeningSeconds += play.durationSeconds;

    add(byRecord, record.id, play.durationSeconds);
    for (const artist of record.artists) {
      const entry = byArtist.get(artist.id) ?? {
        name: artist.name,
        spinCount: 0,
        listeningSeconds: 0,
      };
      entry.spinCount += 1;
      entry.listeningSeconds += play.durationSeconds;
      byArtist.set(artist.id, entry);
    }

    const genres = record.genres.length > 0 ? record.genres : [NO_GENRE];
    const share = play.durationSeconds / genres.length;
    const month = monthKey(play.playedAt);
    for (const genre of genres) {
      const months = genreMonths.get(genre) ?? new Map<string, number>();
      months.set(month, (months.get(month) ?? 0) + share);
      genreMonths.set(genre, months);
    }
  }

  const topArtists = [...byArtist.entries()]
    .map(([id, totals]) => ({ id, ...totals }))
    .sort((a, b) => byListening(a, b) || a.name.localeCompare(b.name))
    .slice(0, TOP_COUNT);

  const topRecords = [...byRecord.entries()]
    .flatMap(([id, totals]) => {
      const record = recordsById.get(id);
      if (!record) return [];
      const { title, artists, coverImageUrl } = record;
      return [{ record: { id, title, artists, coverImageUrl }, ...totals }];
    })
    .sort((a, b) => byListening(a, b) || a.record.title.localeCompare(b.record.title))
    .slice(0, TOP_COUNT);

  // The period's months, from its start (or the first play) to its end. `to` is
  // exclusive ("before Nov 1"), so its month is the one a moment before it.
  const firstPlay = plays[0];
  const lastMoment = query.to ? new Date(Date.parse(query.to) - 1).toISOString() : null;
  const months = firstPlay
    ? monthsBetween(
        monthKey(query.from ?? firstPlay.playedAt),
        monthKey(lastMoment ?? new Date().toISOString()),
      ).slice(-MAX_MONTHS)
    : [];

  return {
    totals: {
      spinCount: plays.length,
      listeningSeconds,
      recordCount: byRecord.size,
      artistCount: byArtist.size,
    },
    topArtists,
    topRecords,
    genresByMonth: { months, genres: topGenresWithOther(genreMonths, months) },
  };
}

function add(map: Map<number, Totals>, key: number, seconds: number) {
  const entry = map.get(key) ?? { spinCount: 0, listeningSeconds: 0 };
  entry.spinCount += 1;
  entry.listeningSeconds += seconds;
  map.set(key, entry);
}

/** Most listening time first; then most plays. */
function byListening(a: Totals, b: Totals) {
  return b.listeningSeconds - a.listeningSeconds || b.spinCount - a.spinCount;
}

/** The 5 biggest genres over the period, then everything else added up as "Other". */
function topGenresWithOther(genreMonths: Map<string, Map<string, number>>, months: string[]) {
  const total = (m: Map<string, number>) => [...m.values()].reduce((sum, s) => sum + s, 0);
  const ranked = [...genreMonths.entries()].sort(
    ([nameA, a], [nameB, b]) => total(b) - total(a) || nameA.localeCompare(nameB),
  );

  const series = ranked
    .slice(0, GENRE_COUNT)
    .map(([name, byMonth]) => ({ name, seconds: months.map((m) => byMonth.get(m) ?? 0) }));
  const rest = ranked.slice(GENRE_COUNT);
  if (rest.length > 0) {
    series.push({
      name: OTHER,
      seconds: months.map((m) => rest.reduce((sum, [, byMonth]) => sum + (byMonth.get(m) ?? 0), 0)),
    });
  }
  return series.map((s) => ({ ...s, seconds: s.seconds.map(Math.round) }));
}

/** "2026-10" for a time, in the viewer's time zone. */
export function localMonth(iso: string, utcOffsetMinutes: number): string {
  const local = new Date(Date.parse(iso) + utcOffsetMinutes * 60_000);
  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Every month from `first` to `last`, inclusive: "2026-11", "2026-12", "2027-01". */
export function monthsBetween(first: string, last: string): string[] {
  const months: string[] = [];
  let [year, month] = first.split('-').map(Number) as [number, number];
  const [lastYear, lastMonth] = last.split('-').map(Number) as [number, number];
  while (year < lastYear || (year === lastYear && month <= lastMonth)) {
    months.push(`${year}-${String(month).padStart(2, '0')}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
}
