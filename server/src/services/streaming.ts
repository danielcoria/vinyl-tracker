// ============================================================================
// streaming.ts (service): STREAMING VS. SHELF, AND VINYL PRICES
//
//   getStreaming    a person's most-streamed albums (from Last.fm), each
//                   marked as on their shelf, on their wishlist, or neither
//   getVinylPrice   the cheapest vinyl copy of an album on Discogs right now
//                   (compares the top few pressings)
//
// The tricky part is deciding that a streamed album and a record on the shelf
// are the same album. Names are compared in plain text (no capitals, accents
// or punctuation), in two steps:
//   exactKey   the same album AND edition: "Kind of Blue" = "Kind Of Blue".
//              Only this counts as "on your shelf".
//   albumKey   the same album in any edition: "Rumours (Super Deluxe)" and
//              "Rumours". Shown as "you own a different edition", because a
//              collector may want both.
// ============================================================================

import type { Streaming, StreamingPeriod, VinylPrice } from '@vinyl/shared';
import type { Db } from '../db/client.js';
import { AppError } from '../errors.js';
import type { DiscogsClient } from '../integrations/discogs/client.js';
import type { LastfmSource } from '../integrations/lastfm/client.js';
import { listRecords } from './records.js';
import { getSettings } from './settings.js';
import { listWishlist } from './wishlist.js';

export async function getStreaming(
  db: Db,
  userId: number,
  lastfm: LastfmSource,
  period: StreamingPeriod,
): Promise<Streaming> {
  const username = getSettings(db, userId).lastfmUsername;
  if (!username) {
    throw new AppError(
      400,
      'LASTFM_NO_USERNAME',
      'Enter your Last.fm username first, so there is something to compare.',
    );
  }

  const topAlbums = await lastfm.getTopAlbums(username, period);

  // The shelf, looked up two ways: by exact album, and by album in any edition.
  const owned = new Map<string, number>();
  const anyEdition = new Map<string, { recordId: number; title: string }>();
  for (const record of listRecords(db, userId, { sort: 'added' })) {
    for (const artist of record.artists) {
      owned.set(exactKey(artist.name, record.title), record.id);
      anyEdition.set(albumKey(artist.name, record.title), {
        recordId: record.id,
        title: record.title,
      });
    }
  }
  // A wishlist entry is for one edition: wishing for the deluxe isn't wishing for the regular.
  const wished = new Map(
    listWishlist(db, userId).map((item) => [exactKey(item.artist, item.title), item.id]),
  );

  return {
    username,
    period,
    sample: lastfm.isSample(username),
    albums: topAlbums.map((album) => {
      const key = exactKey(album.artist, album.title);
      const ownedRecordId = owned.get(key) ?? null;
      return {
        rank: album.rank,
        title: album.title,
        artist: album.artist,
        playCount: album.playCount,
        coverImageUrl: album.coverImageUrl,
        lastfmUrl: album.url,
        ownedRecordId,
        otherEdition:
          ownedRecordId === null
            ? (anyEdition.get(albumKey(album.artist, album.title)) ?? null)
            : null,
        wishlistItemId: wished.get(key) ?? null,
      };
    }),
  };
}

/** The same album and edition: "Kind of Blue" by "Miles Davis" and "KIND OF BLUE" by "miles davis". */
export function exactKey(artist: string, title: string): string {
  return `${plainName(artist)}|${plainName(title)}`;
}

/** The same album in any edition: "Rumours (Super Deluxe)" and "Rumours" give the same key. */
export function albumKey(artist: string, title: string): string {
  return `${plainName(artist)}|${plainName(stripEdition(title))}`;
}

/** Drops the extras streaming services add: "(Deluxe Edition)", "[Remastered]", " - 2011 Remaster". */
export function stripEdition(title: string): string {
  const EDITION =
    /deluxe|remaster|edition|anniversary|expanded|extended|bonus|version|mono|stereo|reissue/i;
  let result = title
    // Brackets are only dropped when they hold an edition word: "(What's the Story)" stays.
    .replace(/\s*[([]([^)\]]*)[)\]]/g, (whole, inside: string) =>
      EDITION.test(inside) ? '' : whole,
    );
  const dash = result.lastIndexOf(' - ');
  if (dash > 0 && EDITION.test(result.slice(dash))) result = result.slice(0, dash);
  return result;
}

/** Lowercase letters and numbers only: no accents, punctuation, spaces or leading "the". */
export function plainName(text: string): string {
  return text
    .normalize('NFD') // splits "ö" into "o" + its dots...
    .replace(/[̀-ͯ]/g, '') // ...so the dots can be dropped
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/^the\s+/, '')
    .replace(/[^a-z0-9]/g, '');
}

/** How many pressings to compare prices for (each one is a request to Discogs). */
const PRESSINGS_TO_CHECK = 3;

/**
 * The cheapest vinyl copy of an album for sale on Discogs. An album has many
 * pressings and the first one found is often a rare one, so the top few are
 * compared and the cheapest that actually has copies for sale wins.
 */
export async function getVinylPrice(
  discogs: DiscogsClient,
  album: { artist: string; title: string },
): Promise<VinylPrice> {
  const search = await discogs.searchAlbum(album.artist, stripEdition(album.title));
  const pressings = search.results.slice(0, PRESSINGS_TO_CHECK);
  const first = pressings[0];
  if (!first) {
    return {
      found: false,
      releaseId: null,
      releaseTitle: null,
      lowestPrice: null,
      currency: null,
      numForSale: 0,
    };
  }

  // Ask for all of them at once. "allSettled" = wait for every answer, even failed ones.
  const answers = await Promise.allSettled(
    pressings.map((pressing) => discogs.getMarketplaceStats(pressing.id)),
  );
  // If Discogs couldn't answer for any of them, say so rather than "none for sale".
  const failure = answers.find((answer) => answer.status === 'rejected');
  if (failure && answers.every((answer) => answer.status === 'rejected')) throw failure.reason;

  const priced = answers.flatMap((answer, i) => {
    const pressing = pressings[i];
    const price = answer.status === 'fulfilled' ? answer.value.lowest_price : null;
    if (!pressing || !price || answer.status !== 'fulfilled') return [];
    return [{ pressing, price, numForSale: answer.value.num_for_sale ?? 0 }];
  });
  const cheapest = priced.sort((a, b) => a.price.value - b.price.value)[0];

  return {
    found: true,
    releaseId: (cheapest?.pressing ?? first).id,
    releaseTitle: (cheapest?.pressing ?? first).title,
    lowestPrice: cheapest?.price.value ?? null,
    currency: cheapest?.price.currency ?? null,
    numForSale: cheapest?.numForSale ?? 0,
  };
}
