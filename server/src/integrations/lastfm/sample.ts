// ============================================================================
// lastfm/sample.ts: BUILT-IN SAMPLE "MOST STREAMED" ALBUMS FOR THE DEMO
//
// The public demo has no real Last.fm account behind it, so this stands in
// for Last.fm with a made-up listener: some albums that are on the demo shelf
// and some that aren't, so "streaming vs. shelf" has something to show.
// The website labels it as sample data.
//
// The demo account's username (DEMO_LASTFM_USERNAME) always gets the samples.
// If the demo site also has a real API key, every other username is passed on
// to the real Last.fm, so visitors who sign up can compare their own account.
//
// It also knows a few "similar artists" and their best-known albums for the
// demo shelf, used for recommendations only when there is no real API key.
// ============================================================================

import type { StreamingPeriod } from '@vinyl/shared';
import type { ArtistAlbum, LastfmSource, SimilarArtist, TopAlbum } from './client.js';

/** [title, artist, plays over the last 12 months] */
const ALBUMS: [string, string, number][] = [
  ['In Rainbows', 'Radiohead', 412],
  ['To Pimp a Butterfly', 'Kendrick Lamar', 388],
  ['Blonde', 'Frank Ocean', 341],
  // A different edition from the "Rumours" on the demo shelf, to show that group.
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

/** Artists on the demo shelf -> [similar artist, how alike (0 to 1)]. */
const SIMILAR: Record<string, [string, number][]> = {
  'miles davis': [
    ['John Coltrane', 1],
    ['Charles Mingus', 0.8],
    ['Herbie Hancock', 0.75],
    ['Thelonious Monk', 0.7],
  ],
  'john coltrane': [
    ['Miles Davis', 1],
    ['Charles Mingus', 0.85],
    ['Thelonious Monk', 0.8],
    ['Pharoah Sanders', 0.7],
  ],
  'kendrick lamar': [
    ['J. Cole', 0.9],
    ['Tyler, the Creator', 0.7],
    ['Frank Ocean', 0.6],
  ],
  radiohead: [
    ['Thom Yorke', 0.9],
    ['Portishead', 0.6],
    ['Björk', 0.55],
  ],
  'fleetwood mac': [
    ['Stevie Nicks', 0.9],
    ['Tom Petty and the Heartbreakers', 0.6],
  ],
  'joni mitchell': [
    ['Carole King', 0.8],
    ['Nick Drake', 0.6],
  ],
  'marvin gaye': [
    ['Stevie Wonder', 0.9],
    ['Al Green', 0.85],
    ['Curtis Mayfield', 0.8],
  ],
  'amy winehouse': [
    ['Etta James', 0.55],
    ['Erykah Badu', 0.5],
    ['Al Green', 0.4],
  ],
  'pink floyd': [
    ['David Gilmour', 0.9],
    ['Led Zeppelin', 0.6],
  ],
  'daft punk': [
    ['Justice', 0.8],
    ['Air', 0.6],
  ],
  nirvana: [
    ['Soundgarden', 0.7],
    ['Pixies', 0.6],
  ],
  'the beatles': [
    ['The Rolling Stones', 0.6],
    ['The Beach Boys', 0.6],
  ],
};

/** Similar artist -> their best-known album. */
const BEST_ALBUM: Record<string, string> = {
  'charles mingus': 'Mingus Ah Um',
  'herbie hancock': 'Head Hunters',
  'thelonious monk': "Monk's Dream",
  'pharoah sanders': 'Karma',
  'j. cole': '2014 Forest Hills Drive',
  'tyler, the creator': 'IGOR',
  'frank ocean': 'Blonde',
  'thom yorke': 'The Eraser',
  portishead: 'Dummy',
  björk: 'Homogenic',
  'stevie nicks': 'Bella Donna',
  'tom petty and the heartbreakers': 'Damn the Torpedoes',
  'carole king': 'Tapestry',
  'nick drake': 'Pink Moon',
  'stevie wonder': 'Songs in the Key of Life',
  'al green': "Let's Stay Together",
  'curtis mayfield': 'Curtis',
  'etta james': 'At Last!',
  'erykah badu': 'Baduizm',
  'david gilmour': 'On an Island',
  'led zeppelin': 'Led Zeppelin IV',
  justice: 'Cross',
  air: 'Moon Safari',
  soundgarden: 'Superunknown',
  pixies: 'Doolittle',
  'the rolling stones': 'Sticky Fingers',
  'the beach boys': 'Pet Sounds',
};

/** The made-up listener the demo account is "connected" to. */
export const DEMO_LASTFM_USERNAME = 'demo_listener';

/**
 * `real` is the actual Last.fm client when there's an API key, otherwise null
 * (then every username gets the samples).
 */
export function sampleLastfm(real: LastfmSource | null = null): LastfmSource {
  const isSample = (username: string) =>
    real === null || username.toLowerCase() === DEMO_LASTFM_USERNAME;
  return {
    isSample,
    sampleArtists: real === null,
    // Scrobbling is never faked: it's the real Last.fm, or not available.
    canScrobble: real?.canScrobble ?? false,
    authorizeUrl: (callbackUrl) => {
      if (!real) throw new Error('Scrobbling needs a real Last.fm connection');
      return real.authorizeUrl(callbackUrl);
    },
    getSession: (token) => {
      if (!real) throw new Error('Scrobbling needs a real Last.fm connection');
      return real.getSession(token);
    },
    scrobble: (sessionKey, tracks) => {
      if (!real) throw new Error('Scrobbling needs a real Last.fm connection');
      return real.scrobble(sessionKey, tracks);
    },
    getSimilarArtists(artist) {
      if (real) return real.getSimilarArtists(artist);
      const similar = SIMILAR[artist.toLowerCase()] ?? [];
      return Promise.resolve(similar.map(([name, match]): SimilarArtist => ({ name, match })));
    },
    getArtistTopAlbums(artist) {
      if (real) return real.getArtistTopAlbums(artist);
      const title = BEST_ALBUM[artist.toLowerCase()];
      const albums: ArtistAlbum[] = title
        ? [{ title, artist, coverImageUrl: null, url: null }]
        : [];
      return Promise.resolve(albums);
    },
    getTopAlbums(username, period) {
      if (real && !isSample(username)) return real.getTopAlbums(username, period);
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
