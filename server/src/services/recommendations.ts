// ============================================================================
// recommendations.ts (service): ALBUMS TO CONSIDER, BASED ON THE SHELF
//
// How a suggestion is made:
//
//   1. Pick the shelf's "key artists": each artist gets points for every
//      record owned, for plays, and for star ratings. The top 6 are used.
//   2. Ask Last.fm which artists are similar to each key artist.
//   3. Drop artists already on the shelf (and near-duplicates like "Miles
//      Davis Quintet"), then add up each remaining artist's similarity across
//      the key artists. Someone similar to three of your artists beats
//      someone similar to one.
//   4. For the best of them, ask Last.fm for their best-known album and
//      suggest it, unless it's already owned. At most two suggestions come
//      from the same key artist, so one favorite doesn't fill the whole list.
//
// Everything Last.fm says is remembered for a day by its client, so opening
// the page again is instant and doesn't ask twice.
// ============================================================================

import type { Recommendation, Recommendations, VinylRecord } from '@vinyl/shared';
import type { Db } from '../db/client.js';
import type { LastfmSource } from '../integrations/lastfm/client.js';
import { listRecords } from './records.js';
import { albumKey, plainName, stripEdition } from './streaming.js';
import { listWishlist } from './wishlist.js';

const KEY_ARTISTS = 6;
const RECOMMENDATIONS = 10;
/** How many similar artists to look up albums for (more than shown, to allow for variety). */
const CANDIDATES = 18;
/** At most this many suggestions whose main reason is the same key artist. */
const PER_KEY_ARTIST = 2;
const REASONS = 3;
/** Not proper albums: compilations, and singles like "Song (with Someone)" or "Song (feat. X)". */
const NOT_AN_ALBUM =
  /greatest hits|best of|the essential|anthology|collection|singles|\(with |\bfeat\b|\bfeaturing\b/i;

export async function getRecommendations(
  db: Db,
  userId: number,
  lastfm: LastfmSource,
): Promise<Recommendations> {
  const shelf = listRecords(db, userId, { sort: 'added' });
  const keyArtists = pickKeyArtists(shelf);
  if (keyArtists.length === 0) {
    return { recommendations: [], basedOn: [], sample: lastfm.sampleArtists };
  }

  // Ask about every key artist at once. "allSettled" = wait for every answer, even failed ones.
  const answers = await Promise.allSettled(
    keyArtists.map((artist) => lastfm.getSimilarArtists(artist.name)),
  );
  // If Last.fm couldn't answer for any of them, say so rather than "nothing to suggest".
  const failure = answers.find((answer) => answer.status === 'rejected');
  if (failure && answers.every((answer) => answer.status === 'rejected')) throw failure.reason;

  const ownedArtists = new Set(shelf.flatMap((r) => r.artists.map((a) => plainName(a.name))));
  const isOwnedArtist = (name: string) => {
    const plain = plainName(name);
    // "Miles Davis Quintet" is Miles Davis again, not a discovery.
    return [...ownedArtists].some((owned) => plain === owned || plain.includes(owned));
  };

  // Similar artist -> total score, and which key artists pointed to them.
  const candidates = new Map<string, { name: string; score: number; because: Reason[] }>();
  answers.forEach((answer, i) => {
    const keyArtist = keyArtists[i];
    if (answer.status !== 'fulfilled' || !keyArtist) return;
    for (const similar of answer.value) {
      if (isOwnedArtist(similar.name)) continue;
      const points = similar.match * keyArtist.weight;
      const entry = candidates.get(plainName(similar.name)) ?? {
        name: similar.name,
        score: 0,
        because: [],
      };
      entry.score += points;
      entry.because.push({ artist: keyArtist.name, points });
      candidates.set(plainName(similar.name), entry);
    }
  });

  const best = [...candidates.values()]
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, CANDIDATES);

  const ownedAlbums = new Set(
    shelf.flatMap((r) => r.artists.map((a) => albumKey(a.name, r.title))),
  );
  const wished = new Map(
    listWishlist(db, userId).map((item) => [albumKey(item.artist, item.title), item.id]),
  );

  const albums = await Promise.allSettled(
    best.map((candidate) => lastfm.getArtistTopAlbums(candidate.name)),
  );
  const found = best.flatMap((candidate, i): Recommendation[] => {
    const answer = albums[i];
    if (answer?.status !== 'fulfilled') return [];
    // Their best-known proper album that isn't on the shelf already.
    const album =
      answer.value.find(
        (a) => !NOT_AN_ALBUM.test(a.title) && !ownedAlbums.has(albumKey(candidate.name, a.title)),
      ) ?? null;
    if (!album) return [];
    return [
      {
        // "Bella Donna (2016 Remastered)" is shown as "Bella Donna".
        title: stripEdition(album.title).trim() || album.title,
        artist: candidate.name,
        coverImageUrl: album.coverImageUrl,
        lastfmUrl: album.url,
        because: candidate.because
          .sort((a, b) => b.points - a.points)
          .slice(0, REASONS)
          .map((reason) => reason.artist),
        wishlistItemId: wished.get(albumKey(candidate.name, album.title)) ?? null,
      },
    ];
  });

  // Keep the order (best first), but no more than two per main reason.
  const perKeyArtist = new Map<string, number>();
  const recommendations = found
    .filter((recommendation) => {
      const main = recommendation.because[0] ?? '';
      const soFar = perKeyArtist.get(main) ?? 0;
      perKeyArtist.set(main, soFar + 1);
      return soFar < PER_KEY_ARTIST;
    })
    .slice(0, RECOMMENDATIONS);

  return {
    recommendations,
    basedOn: keyArtists.map((artist) => artist.name),
    sample: lastfm.sampleArtists,
  };
}

type Reason = { artist: string; points: number };

/**
 * The artists that best describe the shelf, with a weight from 0 to 1 (the top
 * artist = 1). Each record gives its artists 1 point for being owned, up to 1
 * more for plays (5 or more plays = the full point), and up to 1 for its rating.
 */
export function pickKeyArtists(shelf: VinylRecord[]): { name: string; weight: number }[] {
  const points = new Map<number, { name: string; points: number }>();
  for (const record of shelf) {
    const forRecord = 1 + Math.min(record.spinCount, 5) / 5 + (record.rating ?? 2.5) / 5;
    for (const artist of record.artists) {
      const entry = points.get(artist.id) ?? { name: artist.name, points: 0 };
      entry.points += forRecord;
      points.set(artist.id, entry);
    }
  }
  const ranked = [...points.values()]
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name))
    .slice(0, KEY_ARTISTS);
  const top = ranked[0]?.points ?? 1;
  return ranked.map((artist) => ({ name: artist.name, weight: artist.points / top }));
}
