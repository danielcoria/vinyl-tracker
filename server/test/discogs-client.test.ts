// ============================================================================
// discogs-client.test.ts: TESTS FOR TALKING TO DISCOGS
//
// Checks the token is sent, answers are remembered (cache), the 60-a-minute
// limit is respected, and Discogs problems become clear errors.
// A fake clock (`now`) lets these tests skip ahead in time instantly.
// ============================================================================

import { describe, expect, it } from 'vitest';
import { DiscogsClient, DiscogsError } from '../src/integrations/discogs/client.js';
import { fakeDiscogs, KIND_OF_BLUE_RELEASE_ID } from './discogs-helpers.js';

/** A clock tests can move forward by hand. */
function fakeClock() {
  let time = 1_000_000;
  return { now: () => time, advance: (ms: number) => (time += ms) };
}

const MINUTE = 60_000;

describe('DiscogsClient', () => {
  it('sends the token and app name, and asks for vinyl releases', async () => {
    const { client, requests } = fakeDiscogs();

    await client.search('kind of blue', 2);

    const [request] = requests;
    expect(request?.headers.Authorization).toBe('Discogs token=test-token');
    expect(request?.headers['User-Agent']).toBe('VinylTrackerTests/1.0');
    expect(Object.fromEntries(request?.url.searchParams ?? [])).toMatchObject({
      q: 'kind of blue',
      type: 'release',
      format: 'Vinyl',
      page: '2',
    });
  });

  it('remembers answers, ignoring capital letters in searches', async () => {
    const { client, requests } = fakeDiscogs();

    await client.search('Kind of Blue', 1);
    await client.search('kind of blue', 1);
    await client.getRelease(KIND_OF_BLUE_RELEASE_ID);
    await client.getRelease(KIND_OF_BLUE_RELEASE_ID);

    expect(requests).toHaveLength(2);
  });

  it('forgets searches after 10 minutes', async () => {
    const clock = fakeClock();
    const { client, requests } = fakeDiscogs({}, { now: clock.now });

    await client.search('blue', 1);
    clock.advance(9 * MINUTE);
    await client.search('blue', 1);
    expect(requests).toHaveLength(1);

    clock.advance(2 * MINUTE);
    await client.search('blue', 1);
    expect(requests).toHaveLength(2);
  });

  it('stops at 60 requests a minute, then allows more once the minute passes', async () => {
    const clock = fakeClock();
    const { client, requests } = fakeDiscogs({}, { now: clock.now });

    // 60 different searches, so none come from the cache.
    for (let i = 0; i < 60; i++) await client.search(`search ${i}`, 1);
    await expect(client.search('one too many', 1)).rejects.toMatchObject({
      status: 503,
      code: 'DISCOGS_BUSY',
    });
    expect(requests).toHaveLength(60); // the 61st never reached Discogs

    clock.advance(MINUTE);
    await expect(client.search('one too many', 1)).resolves.toBeDefined();
  });

  it.each([
    [404, 'DISCOGS_NOT_FOUND', 404],
    [429, 'DISCOGS_BUSY', 503],
    [401, 'DISCOGS_AUTH', 502],
    [500, 'DISCOGS_UNAVAILABLE', 502],
  ])('turns a Discogs %i into %s', async (discogsStatus, code, ourStatus) => {
    const { client } = fakeDiscogs({
      '/releases/1': () => Response.json({}, { status: discogsStatus }),
    });

    const error = await client.getRelease(1).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(DiscogsError);
    expect(error).toMatchObject({ code, status: ourStatus });
  });

  it('reports an answer with an unexpected shape', async () => {
    const { client } = fakeDiscogs({ '/releases/1': () => Response.json({ nope: true }) });

    await expect(client.getRelease(1)).rejects.toMatchObject({ code: 'DISCOGS_BAD_RESPONSE' });
  });

  it("reports when Discogs can't be reached", async () => {
    const { client } = fakeDiscogs({
      '/releases/1': () => {
        throw new TypeError('fetch failed');
      },
    });

    await expect(client.getRelease(1)).rejects.toMatchObject({ code: 'DISCOGS_UNAVAILABLE' });
  });
});

describe('DiscogsClient address', () => {
  it('can be pointed somewhere else (the end-to-end tests use a fake Discogs)', async () => {
    const urls: string[] = [];
    const client = new DiscogsClient({
      token: 't',
      userAgent: 'ua',
      apiUrl: 'http://localhost:3199',
      fetch: (async (input: string | URL | Request) => {
        urls.push(String(input));
        return Response.json({ pagination: { page: 1, pages: 1 }, results: [] });
      }) as typeof fetch,
    });

    await client.search('blue', 1);

    expect(urls[0]).toMatch(/^http:\/\/localhost:3199\/database\/search\?/);
  });
});
