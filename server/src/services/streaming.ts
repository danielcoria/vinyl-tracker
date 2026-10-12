// ============================================================================
// streaming.ts (service): STREAMING VS. SHELF, AND VINYL PRICES
//
//   getStreaming    a person's most-streamed albums (from Last.fm), each
//                   marked as on their shelf, on their wishlist, or neither
//   getVinylPrice   the cheapest copy of an album on Discogs right now
//
// The tricky part is deciding that a streamed album and a record on the shelf
// are the same album: streaming services write "Rumours (Super Deluxe)" or
// "Abbey Road - Remastered", the shelf says "Rumours". `albumKey` boils both
// down to the same plain text before comparing.
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

  // The shelf and the wishlist, looked up by "artist|title" in plain text.
  const owned = new Map<string, number>();
  for (const record of listRecords(db, userId, { sort: 'added' })) {
    for (const artist of record.artists) {
      owned.set(albumKey(artist.name, record.title), record.id);
    }
  }
  const wished = new Map(
    listWishlist(db, userId).map((item) => [albumKey(item.artist, item.title), item.id]),
  );

  return {
    username,
    period,
    sample: lastfm.sample,
    albums: topAlbums.map((album) => {
      const key = albumKey(album.artist, album.title);
      return {
        rank: album.rank,
        title: album.title,
        artist: album.artist,
        playCount: album.playCount,
        coverImageUrl: album.coverImageUrl,
        lastfmUrl: album.url,
        ownedRecordId: owned.get(key) ?? null,
        wishlistItemId: wished.get(key) ?? null,
      };
    }),
  };
}

/** "Rumours (Super Deluxe)" by "Fleetwood Mac" and "Rumours" by "fleetwood mac" give the same key. */
export function albumKey(artist: string, title: string): string {
  return `${plain(artist)}|${plain(stripEdition(title))}`;
}

/** Drops the extras streaming services add: "(Deluxe Edition)", "[Remastered]", " - 2011 Remaster". */
function stripEdition(title: string): string {
  const EDITION = /deluxe|remaster|edition|anniversary|expanded|bonus|version|mono|stereo|reissue/i;
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
function plain(text: string): string {
  return text
    .normalize('NFD') // splits "ö" into "o" + its dots...
    .replace(/[̀-ͯ]/g, '') // ...so the dots can be dropped
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/^the\s+/, '')
    .replace(/[^a-z0-9]/g, '');
}

/** The closest vinyl pressing on Discogs and its cheapest copy for sale. */
export async function getVinylPrice(
  discogs: DiscogsClient,
  album: { artist: string; title: string },
): Promise<VinylPrice> {
  const search = await discogs.searchAlbum(album.artist, stripEdition(album.title));
  const pressing = search.results[0];
  if (!pressing) {
    return {
      found: false,
      releaseId: null,
      releaseTitle: null,
      lowestPrice: null,
      currency: null,
      numForSale: 0,
    };
  }

  const stats = await discogs.getMarketplaceStats(pressing.id);
  return {
    found: true,
    releaseId: pressing.id,
    releaseTitle: pressing.title,
    lowestPrice: stats.lowest_price?.value ?? null,
    currency: stats.lowest_price?.currency ?? null,
    numForSale: stats.num_for_sale ?? 0,
  };
}
