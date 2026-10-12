// ============================================================================
// lastfm/sample.ts: BUILT-IN SAMPLE "MOST STREAMED" ALBUMS FOR THE DEMO
//
// The public demo has no real Last.fm account behind it, so this stands in
// for Last.fm with a made-up listener: some albums that are on the demo shelf
// and some that aren't, so "streaming vs. shelf" has something to show.
// The website labels it as sample data. Never used when a real API key is set.
// ============================================================================

import type { StreamingPeriod } from '@vinyl/shared';
import type { LastfmSource, TopAlbum } from './client.js';

/** [title, artist, plays over the last 12 months] */
const ALBUMS: [string, string, number][] = [
  ['In Rainbows', 'Radiohead', 412],
  ['To Pimp a Butterfly', 'Kendrick Lamar', 388],
  ['Blonde', 'Frank Ocean', 341],
  // Spelled the way streaming services do, to show it still matches the shelf.
  ['Rumours (Super Deluxe)', 'Fleetwood Mac', 305],
  ['Currents', 'Tame Impala', 274],
  ['Kind of Blue', 'Miles Davis', 251],
  ['good kid, m.A.A.d city', 'Kendrick Lamar', 236],
  ['Songs in the Key of Life', 'Stevie Wonder', 214],
  ['Discovery', 'Daft Punk', 198],
  ['Vespertine', 'Björk', 176],
  ['Back to Black', 'Amy Winehouse', 169],
  ['Illinois', 'Sufjan Stevens', 151],
  ['Pet Sounds', 'The Beach Boys', 140],
  ['OK Computer', 'Radiohead', 133],
  ['Madvillainy', 'Madvillain', 121],
  ['Homogenic', 'Björk', 97],
];

/** Shorter periods have fewer plays; "overall" has more. */
const SCALE: Record<StreamingPeriod, number> = {
  overall: 2.6,
  '12month': 1,
  '6month': 0.55,
  '3month': 0.3,
  '1month': 0.11,
};

export function sampleLastfm(): LastfmSource {
  return {
    sample: true,
    getTopAlbums(_username, period) {
      const albums = ALBUMS.map(([title, artist, plays], index): TopAlbum => ({
        rank: index + 1,
        title,
        artist,
        playCount: Math.max(1, Math.round(plays * SCALE[period])),
        coverImageUrl: null,
        url: null,
      }));
      return Promise.resolve(albums);
    },
  };
}
