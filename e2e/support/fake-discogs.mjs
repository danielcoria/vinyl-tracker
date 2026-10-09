// ============================================================================
// fake-discogs.mjs: A PRETEND DISCOGS FOR THE END-TO-END TESTS
//
// The real server is started with DISCOGS_API_URL pointing here, so tests never
// contact the real Discogs (no token or internet needed, and always the same
// answers). It replies with real Discogs answers saved in the server's test
// fixtures:
//   GET /database/search         -> a search for "Kind of Blue"
//   GET /releases/2772432        -> the full Kind of Blue release
//   anything else                -> 404, like Discogs for an unknown release
// ============================================================================

import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';

const PORT = Number(process.env.FAKE_DISCOGS_PORT ?? 3199);
const fixture = (name) =>
  readFileSync(new URL(`../../server/test/fixtures/discogs/${name}`, import.meta.url), 'utf8');

const routes = {
  '/health': () => '{"status":"ok"}',
  '/database/search': () => fixture('search-kind-of-blue.json'),
  '/releases/2772432': () => fixture('release-2772432.json'),
};

createServer((req, res) => {
  const { pathname } = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const route = routes[pathname];
  res.writeHead(route ? 200 : 404, { 'Content-Type': 'application/json' });
  res.end(route ? route() : '{"message":"Release not found."}');
}).listen(PORT, () => console.log(`Fake Discogs on http://localhost:${PORT}`));
