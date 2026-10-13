// ============================================================================
// fake-discogs.mjs: A PRETEND DISCOGS (AND LAST.FM) FOR THE END-TO-END TESTS
//
// The real server is started with DISCOGS_API_URL pointing here, so tests never
// contact the real Discogs (no token or internet needed, and always the same
// answers). It replies with real Discogs answers saved in the server's test
// fixtures:
//   GET /database/search         -> a search for "Kind of Blue"
//   GET /releases/2772432        -> the full Kind of Blue release
//   GET /marketplace/stats/2772432 -> its cheapest copy for sale
//   anything else                -> 404, like Discogs for an unknown release
//
// It also plays Last.fm, so one small server covers both:
//   GET  /2.0/?method=...        -> a listener's most-streamed albums, artists
//                                   similar to Miles Davis, or John Coltrane's
//                                   best-known albums, whoever is asked about
//   GET  /api/auth/?cb=...       -> the "approve this app" page: it approves
//                                   straight away and sends the browser back
//   POST /2.0/ (auth.getSession) -> a session for the listener "e2e_listener"
//   POST /2.0/ (track.scrobble)  -> accepts the songs and remembers them
//   GET  /scrobbles              -> every song scrobbled so far (for tests to check)
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

/** Songs received through track.scrobble, in the order they arrived. */
const scrobbled = [];

/** Signed Last.fm requests arrive as a form in the body of a POST. */
function lastfmPost(form) {
  if (form.get('method') === 'auth.getSession') {
    return JSON.stringify({
      session: { name: 'e2e_listener', key: 'e2e-session-key', subscriber: 0 },
    });
  }
  if (form.get('method') === 'track.scrobble') {
    let count = 0;
    while (form.has(`track[${count}]`)) {
      scrobbled.push({
        artist: form.get(`artist[${count}]`),
        track: form.get(`track[${count}]`),
        album: form.get(`album[${count}]`),
        sessionKey: form.get('sk'),
      });
      count += 1;
    }
    return JSON.stringify({ scrobbles: { '@attr': { accepted: count, ignored: 0 } } });
  }
  return JSON.stringify({ error: 3, message: 'Invalid Method' });
}

const routes = {
  '/health': () => '{"status":"ok"}',
  '/database/search': () => fixture('search-kind-of-blue.json'),
  '/releases/2772432': () => fixture('release-2772432.json'),
  '/marketplace/stats/2772432': () => fixture('marketplace-stats-2772432.json'),
  '/2.0/': (url) => fixture(LASTFM_ANSWERS[url.searchParams.get('method')], 'lastfm'),
  '/scrobbles': () => JSON.stringify(scrobbled),
};

createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);

  // The "approve this app" page: say yes at once, and go back with a one-time token.
  if (url.pathname === '/api/auth/') {
    res.writeHead(302, { Location: `${url.searchParams.get('cb')}?token=e2e-token` });
    res.end();
    return;
  }

  if (req.method === 'POST' && url.pathname === '/2.0/') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(lastfmPost(new URLSearchParams(body)));
    });
    return;
  }

  const route = routes[url.pathname];
  res.writeHead(route ? 200 : 404, { 'Content-Type': 'application/json' });
  res.end(route ? route(url) : '{"message":"Release not found."}');
}).listen(PORT, () => console.log(`Fake Discogs on http://localhost:${PORT}`));
