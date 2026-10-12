// ============================================================================
// fake-discogs.mjs: A PRETEND DISCOGS FOR THE END-TO-END TESTS
//
// The real server is started with DISCOGS_API_URL pointing here, so tests never
// contact the real Discogs (no token or internet needed, and always the same
// answers). It replies with real Discogs answers saved in the server's test
// fixtures:
//   GET /database/search         -> a search for "Kind of Blue"
//   GET /releases/2772432        -> the full Kind of Blue release
//   GET /marketplace/stats/2772432 -> its cheapest copy for sale
//   GET /2.0/?method=...         -> (as Last.fm) a listener's most-streamed albums,
//                                   artists similar to Miles Davis, or John
//                                   Coltrane's best-known albums, whoever is asked about
//   anything else                -> 404, like Discogs for an unknown release
// ============================================================================

import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';

const PORT = Number(process.env.FAKE_DISCOGS_PORT ?? 3199);
const fixture = (name, folder = 'discogs') =>
  readFileSync(new URL(`../../server/test/fixtures/${folder}/${name}`, import.meta.url), 'utf8');

/** Last.fm puts every question on one address; the "method" says which it is. */
const LASTFM_ANSWERS = {
  'user.gettopalbums': 'top-albums.json',
  'artist.getsimilar': 'similar-miles-davis.json',
  'artist.gettopalbums': 'artist-top-albums-john-coltrane.json',
};

const routes = {
  '/health': () => '{"status":"ok"}',
  '/database/search': () => fixture('search-kind-of-blue.json'),
  '/releases/2772432': () => fixture('release-2772432.json'),
  '/marketplace/stats/2772432': () => fixture('marketplace-stats-2772432.json'),
  // It also plays Last.fm ("most-streamed albums"), so one fake server covers both.
  '/2.0/': (url) => fixture(LASTFM_ANSWERS[url.searchParams.get('method')], 'lastfm'),
};

createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const route = routes[url.pathname];
  res.writeHead(route ? 200 : 404, { 'Content-Type': 'application/json' });
  res.end(route ? route(url) : '{"message":"Release not found."}');
}).listen(PORT, () => console.log(`Fake Discogs on http://localhost:${PORT}`));
