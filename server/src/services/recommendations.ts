// ============================================================================
// recommendations.ts (service): ALBUMS TO CONSIDER, BASED ON THE SHELF
//
// How a suggestion is made:
//
//   1. Pick the shelf's "key artists": each artist gets points for every
//      record owned, for plays, and for star ratings. The top 6 are used.
//   2. Ask Last.fm which artists are similar to each key artist.
//   3. Drop artists already on the shelf (and near-duplicates like "Miles
//      Davis Quintet"). Each key artist now has its own line of similar
//      artists, best first; someone similar to several of your artists moves
//      up the line.
//   4. Take turns: every key artist gets its best available suggestion before
//      anyone gets a second one. So a favorite can't fill the whole list, and
//      an artist whose closest matches you already own still gets the next
//      one down.
//   5. A suggestion is the similar artist's best-known proper album that you
//      don't own in any edition. If Last.fm knows no such album, the next
//      artist in line is used instead.
//
// Everything Last.fm says is remembered for a day by its client, so opening
// the page again is instant and doesn't ask twice.
// ============================================================================

import type { Recommendation, Recommendations, VinylRecord } from '@vinyl/shared';
import type { Db } from '../db/client.js';
import type { ArtistAlbum, LastfmSource } from '../integrations/lastfm/client.js';
import { listRecords } from './records.js';
import { albumKey, plainName, stripEdition } from './streaming.js';
import { listWishlist } from './wishlist.js';

const KEY_ARTISTS = 6;
const RECOMMENDATIONS = 10;
/** With few key artists each one may give more, so the list still fills up. */
const MIN_PER_KEY_ARTIST = 2;
/** Extra artists looked up per key artist, in case some have no album to suggest. */
const SPARE_LOOKUPS = 2;
const REASONS = 3;
/** Not proper albums: compilations, and singles like "Song (with Someone)" or "Song (feat. X)". */
const NOT_AN_ALBUM =
  /greatest hits|best of|the essential|anthology|collection|singles|\(with |\bfeat\b|\bfeaturing\b/i;

type Reason = { artist: string; points: number };
type Candidate = { key: string; name: string; score: number; because: Reason[] };

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

  // Every similar artist not on the shelf: total score, and which key artists pointed to them.
  const candidates = new Map<string, Candidate>();
  answers.forEach((answer, i) => {
    const keyArtist = keyArtists[i];
    if (answer.status !== 'fulfilled' || !keyArtist) return;
    for (const similar of answer.value) {
      if (isOwnedArtist(similar.name)) continue;
      const key = plainName(similar.name);
      const points = similar.match * keyArtist.weight;
      const entry = candidates.get(key) ?? { key, name: similar.name, score: 0, because: [] };
      entry.score += points;
      entry.because.push({ artist: keyArtist.name, points });
      candidates.set(key, entry);
    }
  });

  // Each key artist's own line of similar artists, best first.
  const perKeyArtist = Math.max(MIN_PER_KEY_ARTIST, Math.ceil(RECOMMENDATIONS / keyArtists.length));
  const lines = keyArtists.map((keyArtist) =>
    [...candidates.values()]
      .filter((candidate) => candidate.because.some((r) => r.artist === keyArtist.name))
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
      // Only the front of the line is looked up, to keep the number of requests small.
      .slice(0, perKeyArtist + SPARE_LOOKUPS),
  );

  // Ask for the albums of everyone near the front of a line (each artist once).
  const toLookUp = [...new Map(lines.flat().map((c) => [c.key, c])).values()];
  const albumAnswers = await Promise.allSettled(
    toLookUp.map((candidate) => lastfm.getArtistTopAlbums(candidate.name)),
  );
  const ownedAlbums = new Set(
    shelf.flatMap((r) => r.artists.map((a) => albumKey(a.name, r.title))),
  );
  // Similar artist -> their best-known proper album that isn't on the shelf already.
  const albumOf = new Map<string, ArtistAlbum>();
  toLookUp.forEach((candidate, i) => {
    const answer = albumAnswers[i];
    if (answer?.status !== 'fulfilled') return;
    const album = answer.value.find(
      (a) => !NOT_AN_ALBUM.test(a.title) && !ownedAlbums.has(albumKey(candidate.name, a.title)),
    );
    if (album) albumOf.set(candidate.key, album);
  });

  const wished = new Map(
    listWishlist(db, userId).map((item) => [albumKey(item.artist, item.title), item.id]),
  );

  // Take turns: round 1 gives every key artist one suggestion, round 2 a second...
  const recommendations: Recommendation[] = [];
  const used = new Set<string>();
  for (let round = 0; round < perKeyArtist; round++) {
    keyArtists.forEach((keyArtist, i) => {
      if (recommendations.length === RECOMMENDATIONS) return;
      // The next artist in this line who has an album and hasn't been suggested yet.
      const candidate = lines[i]?.find((c) => albumOf.has(c.key) && !used.has(c.key));
      const album = candidate && albumOf.get(candidate.key);
      if (!candidate || !album) return;
      used.add(candidate.key);

      // The reasons: this turn's key artist first, then the others, strongest first.
      const others = candidate.because
        .filter((reason) => reason.artist !== keyArtist.name)
        .sort((a, b) => b.points - a.points)
        .map((reason) => reason.artist);
      recommendations.push({
        // "Bella Donna (2016 Remastered)" is shown as "Bella Donna".
        title: stripEdition(album.title).trim() || album.title,
        artist: candidate.name,
        coverImageUrl: album.coverImageUrl,
        lastfmUrl: album.url,
        because: [keyArtist.name, ...others].slice(0, REASONS),
        wishlistItemId: wished.get(albumKey(candidate.name, album.title)) ?? null,
      });
    });
  }

  return {
    recommendations,
    basedOn: keyArtists.map((artist) => artist.name),
    sample: lastfm.sampleArtists,
  };
}

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
