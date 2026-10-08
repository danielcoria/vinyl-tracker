// ============================================================================
// discogs-helpers.ts: A PRETEND DISCOGS FOR TESTS
//
// Tests never contact the real Discogs (no network, no token needed in CI).
// fakeDiscogs() builds a real DiscogsClient whose "network" answers from the
// recorded responses in test/fixtures/discogs/, and keeps a list of every
// request so tests can check what was sent.
// ============================================================================

import { readFileSync } from 'node:fs';
import { DiscogsClient } from '../src/integrations/discogs/client.js';

export const KIND_OF_BLUE_RELEASE_ID = 2772432;

export function fixture(name: string): unknown {
  const url = new URL(`./fixtures/discogs/${name}`, import.meta.url);
  return JSON.parse(readFileSync(url, 'utf8'));
}

/** An answer for a path: a JSON body (status 200), or a full Response. */
type Route = (url: URL) => Response;

const DEFAULT_ROUTES: Record<string, Route> = {
  '/database/search': () => Response.json(fixture('search-kind-of-blue.json')),
  [`/releases/${KIND_OF_BLUE_RELEASE_ID}`]: () => Response.json(fixture('release-2772432.json')),
};

export function fakeDiscogs(
  routes: Record<string, Route> = {},
  options: { now?: () => number } = {},
) {
  const allRoutes = { ...DEFAULT_ROUTES, ...routes };
  const requests: { url: URL; headers: Record<string, string> }[] = [];

  const fakeFetch = async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = new URL(String(input));
    requests.push({ url, headers: init.headers as Record<string, string> });
    const route = allRoutes[url.pathname];
    return route ? route(url) : Response.json({ message: 'Release not found.' }, { status: 404 });
  };

  const client = new DiscogsClient({
    token: 'test-token',
    userAgent: 'VinylTrackerTests/1.0',
    fetch: fakeFetch as typeof fetch,
    now: options.now,
  });
  return { client, requests };
}
