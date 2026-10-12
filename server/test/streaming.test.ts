// ============================================================================
// streaming.test.ts: TESTS FOR STREAMING VS. SHELF, PRICES AND THE WISHLIST
//
// Last.fm and Discogs are never contacted: both clients are given saved
// answers from test/fixtures/ instead of the real network.
// ============================================================================

import { readFileSync } from 'node:fs';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  apiErrorSchema,
  streamingSchema,
  vinylPriceSchema,
  wishlistItemSchema,
  wishlistSchema,
} from '@vinyl/shared';
import { createApp } from '../src/app.js';
import { createDb } from '../src/db/client.js';
import { LastfmClient, type LastfmSource } from '../src/integrations/lastfm/client.js';
import { sampleLastfm } from '../src/integrations/lastfm/sample.js';
import { albumKey } from '../src/services/streaming.js';
import { fakeDiscogs, KIND_OF_BLUE_RELEASE_ID } from './discogs-helpers.js';
import { addUser, loggedIn, recordInput } from './helpers.js';

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`./fixtures/lastfm/${name}`, import.meta.url), 'utf8'));
}

/** A Last.fm client that answers from saved files instead of the network. */
function fakeLastfm(
  answer: () => Response = () => Response.json(fixture('top-albums.json')),
  options: { now?: () => number } = {},
) {
  const requests: URL[] = [];
  const fakeFetch = async (input: string | URL | Request) => {
    requests.push(new URL(String(input)));
    return answer();
  };
  const client = new LastfmClient({
    apiKey: 'test-key',
    userAgent: 'VinylTrackerTests/1.0',
    fetch: fakeFetch as typeof fetch,
    now: options.now,
  });
  return { client, requests };
}

const code = (body: unknown) => apiErrorSchema.parse(body).error.code;

describe('matching streamed albums to the shelf', () => {
  it('ignores capitals, punctuation, accents and a leading "The"', () => {
    expect(albumKey('The Beatles', 'Abbey Road')).toBe(albumKey('beatles', 'ABBEY ROAD!'));
    expect(albumKey('Björk', 'Vespertine')).toBe(albumKey('Bjork', 'vespertine'));
    expect(albumKey('Simon & Garfunkel', 'Bookends')).toBe(
      albumKey('Simon and Garfunkel', 'Bookends'),
    );
  });

  it('ignores edition labels that streaming services add', () => {
    const plain = albumKey('Fleetwood Mac', 'Rumours');
    for (const title of [
      'Rumours (Super Deluxe)',
      'Rumours (2004 Remaster)',
      'Rumours [Expanded Edition]',
      'Rumours - Remastered',
      'Rumours (35th Anniversary Edition)',
      'Rumours (Extended Version)',
    ]) {
      expect(albumKey('Fleetwood Mac', title), title).toBe(plain);
    }
  });

  it('keeps brackets that are part of the real title', () => {
    expect(albumKey('Oasis', "(What's the Story) Morning Glory?")).not.toBe(
      albumKey('Oasis', 'Morning Glory?'),
    );
    expect(albumKey('Miles Davis', 'Kind of Blue')).not.toBe(albumKey('Miles Davis', 'Blue'));
    expect(albumKey('Radiohead', 'Kid A')).not.toBe(albumKey('Radiohead', 'Amnesiac'));
  });
});

describe('the Last.fm client', () => {
  it('asks for the top albums and tidies the answer', async () => {
    const { client, requests } = fakeLastfm();

    const albums = await client.getTopAlbums('vinyl_fan', '6month');

    expect(Object.fromEntries(requests[0]?.searchParams ?? [])).toEqual({
      method: 'user.gettopalbums',
      user: 'vinyl_fan',
      period: '6month',
      limit: '50',
      api_key: 'test-key',
      format: 'json',
    });
    expect(albums).toHaveLength(3);
    expect(albums[0]).toEqual({
      rank: 1,
      title: 'In Rainbows',
      artist: 'Radiohead',
      playCount: 412, // arrives as the text "412"
      coverImageUrl: 'https://lastfm.freetls.fastly.net/i/u/300x300/in-rainbows.png', // the biggest
      url: 'https://www.last.fm/music/Radiohead/In+Rainbows',
    });
    // Last.fm sends empty image addresses when it has no cover.
    expect(albums[2]?.coverImageUrl).toBeNull();
  });

  it('remembers answers for an hour, per user and period', async () => {
    let now = 0;
    const { client, requests } = fakeLastfm(undefined, { now: () => now });

    await client.getTopAlbums('vinyl_fan', '12month');
    await client.getTopAlbums('VINYL_FAN', '12month'); // same user
    expect(requests).toHaveLength(1);

    await client.getTopAlbums('vinyl_fan', '1month'); // another period
    expect(requests).toHaveLength(2);

    now += 61 * 60 * 1000;
    await client.getTopAlbums('vinyl_fan', '12month');
    expect(requests).toHaveLength(3);
  });

  it('turns Last.fm problems into clear errors', async () => {
    const cases: [() => Response, number, string][] = [
      [
        () => Response.json(fixture('user-not-found.json'), { status: 404 }),
        404,
        'LASTFM_USER_NOT_FOUND',
      ],
      [
        () => Response.json({ error: 10, message: 'Invalid API key' }, { status: 403 }),
        502,
        'LASTFM_AUTH',
      ],
      [
        () => Response.json({ error: 29, message: 'Rate limit exceeded' }, { status: 429 }),
        503,
        'LASTFM_BUSY',
      ],
      [
        () => Response.json({ error: 8, message: 'Operation failed' }, { status: 500 }),
        502,
        'LASTFM_UNAVAILABLE',
      ],
      [() => Response.json({ something: 'else' }), 502, 'LASTFM_BAD_RESPONSE'],
      [() => new Response('<html>oops</html>', { status: 200 }), 502, 'LASTFM_BAD_RESPONSE'],
    ];
    for (const [answer, status, errorCode] of cases) {
      const { client } = fakeLastfm(answer);
      await expect(client.getTopAlbums('someone', 'overall')).rejects.toMatchObject({
        status,
        code: errorCode,
      });
    }
  });

  it('says Last.fm is unreachable when the network fails', async () => {
    const client = new LastfmClient({
      apiKey: 'test-key',
      userAgent: 'VinylTrackerTests/1.0',
      fetch: (() => Promise.reject(new Error('offline'))) as typeof fetch,
    });

    await expect(client.getTopAlbums('someone', 'overall')).rejects.toMatchObject({
      code: 'LASTFM_UNAVAILABLE',
    });
  });

  it('never puts the API key in an error message', async () => {
    const { client } = fakeLastfm(() => Response.json({ error: 10 }, { status: 403 }));

    const error = await client.getTopAlbums('someone', 'overall').catch((e: Error) => e);

    expect(String((error as Error).message)).not.toContain('test-key');
  });
});

function setup({ lastfm = fakeLastfm().client }: { lastfm?: LastfmSource | null } = {}) {
  const db = createDb(':memory:');
  const discogs = fakeDiscogs();
  const app = createApp({ db, lastfm, discogs: discogs.client });
  const alex = loggedIn(app, addUser(db, 'alex').cookie);
  const blair = loggedIn(app, addUser(db, 'blair').cookie);
  return { db, app, alex, blair, discogs };
}

describe('GET /api/streaming', () => {
  let ctx: ReturnType<typeof setup>;

  beforeEach(() => {
    ctx = setup();
  });

  const connect = () => ctx.alex.put('/api/settings').send({ lastfmUsername: 'vinyl_fan' });

  it('asks for a Last.fm username first', async () => {
    const res = await ctx.alex.get('/api/streaming');

    expect(res.status).toBe(400);
    expect(code(res.body)).toBe('LASTFM_NO_USERNAME');
  });

  it('only accepts things that look like Last.fm usernames', async () => {
    for (const bad of ['x', 'has spaces', 'way_too_long_for_lastfm', '1starts_with_number']) {
      const res = await ctx.alex.put('/api/settings').send({ lastfmUsername: bad });
      expect(res.status, bad).toBe(400);
    }
    expect((await connect()).body.lastfmUsername).toBe('vinyl_fan');
    // And it can be disconnected again.
    const off = await ctx.alex.put('/api/settings').send({ lastfmUsername: null });
    expect(off.body.lastfmUsername).toBeNull();
  });

  it('marks each streamed album as on the shelf, another edition, on the wishlist, or none', async () => {
    await connect();
    const add = async (title: string, artist: string) =>
      (await ctx.alex.post('/api/records').send(recordInput({ title, artists: [artist] }))).body
        .id as number;
    const inRainbows = await add('IN RAINBOWS', 'radiohead'); // capitals don't matter
    const kindOfBlue = await add('Kind Of Blue', 'Miles Davis');
    const wished = (
      await ctx.alex.post('/api/wishlist').send({ title: 'vespertine', artist: 'Bjork' })
    ).body.id;

    const res = await ctx.alex.get('/api/streaming').query({ period: '6month' });

    expect(res.status).toBe(200);
    const streaming = streamingSchema.parse(res.body);
    expect(streaming).toMatchObject({ username: 'vinyl_fan', period: '6month', sample: false });
    expect(
      streaming.albums.map((a) => [a.title, a.ownedRecordId, a.otherEdition, a.wishlistItemId]),
    ).toEqual([
      // The very same album: on the shelf.
      ['In Rainbows', inRainbows, null, null],
      // The shelf has "Kind Of Blue", not the Legacy Edition: a collector may want both,
      // so it isn't counted as owned, but the page can say which edition is on the shelf.
      [
        'Kind of Blue (Legacy Edition)',
        null,
        { recordId: kindOfBlue, title: 'Kind Of Blue' },
        null,
      ],
      ['Vespertine', null, null, wished],
    ]);
  });

  it('keeps wishlist entries apart per edition too', async () => {
    await connect();
    await ctx.alex.post('/api/wishlist').send({ title: 'Kind of Blue', artist: 'Miles Davis' });

    const streaming = streamingSchema.parse((await ctx.alex.get('/api/streaming')).body);

    // Wishing for the regular album isn't wishing for the Legacy Edition.
    const legacy = streaming.albums.find((a) => a.title === 'Kind of Blue (Legacy Edition)');
    expect(legacy?.wishlistItemId).toBeNull();
  });

  it("only compares with your own shelf, not anyone else's", async () => {
    await connect();
    await ctx.blair
      .post('/api/records')
      .send(recordInput({ title: 'In Rainbows', artists: ['Radiohead'] }));

    const streaming = streamingSchema.parse((await ctx.alex.get('/api/streaming')).body);

    expect(streaming.albums.every((a) => a.ownedRecordId === null)).toBe(true);
  });

  it('defaults to the last 12 months and rejects made-up periods', async () => {
    await connect();

    expect((await ctx.alex.get('/api/streaming')).body.period).toBe('12month');
    expect((await ctx.alex.get('/api/streaming').query({ period: 'forever' })).status).toBe(400);
  });

  it('passes on Last.fm errors, like a username that does not exist', async () => {
    ctx = setup({
      lastfm: fakeLastfm(() => Response.json(fixture('user-not-found.json'), { status: 404 }))
        .client,
    });
    await connect();

    const res = await ctx.alex.get('/api/streaming');

    expect(res.status).toBe(404);
    expect(apiErrorSchema.parse(res.body).error).toEqual({
      code: 'LASTFM_USER_NOT_FOUND',
      message: 'Last.fm has no user called “vinyl_fan”. Check the spelling.',
    });
  });

  it('says "not set up" without a Last.fm key, and needs a login', async () => {
    ctx = setup({ lastfm: null });

    const res = await ctx.alex.get('/api/streaming');
    expect(res.status).toBe(503);
    expect(code(res.body)).toBe('LASTFM_NOT_CONFIGURED');

    for (const address of ['/api/streaming', '/api/streaming/price', '/api/wishlist']) {
      expect((await request(ctx.app).get(address)).status, address).toBe(401);
    }
  });

  it('keeps the demo listener on samples when the demo also has a real key', async () => {
    const real = fakeLastfm();
    ctx = setup({ lastfm: sampleLastfm(real.client) });

    await ctx.alex.put('/api/settings').send({ lastfmUsername: 'demo_listener' });
    const demo = streamingSchema.parse((await ctx.alex.get('/api/streaming')).body);
    // Anyone else's username goes to the real Last.fm.
    await ctx.blair.put('/api/settings').send({ lastfmUsername: 'vinyl_fan' });
    const visitor = streamingSchema.parse((await ctx.blair.get('/api/streaming')).body);

    expect(demo).toMatchObject({ sample: true });
    expect(demo.albums).toHaveLength(16);
    expect(visitor).toMatchObject({ sample: false, username: 'vinyl_fan' });
    expect(visitor.albums).toHaveLength(3);
    expect(real.requests).toHaveLength(1);
  });

  it('uses built-in sample albums on the demo, and says so', async () => {
    ctx = setup({ lastfm: sampleLastfm() });
    await connect();

    const year = streamingSchema.parse((await ctx.alex.get('/api/streaming')).body);
    const month = streamingSchema.parse(
      (await ctx.alex.get('/api/streaming').query({ period: '1month' })).body,
    );

    expect(year.sample).toBe(true);
    expect(year.albums).toHaveLength(16);
    expect(year.albums[0]).toMatchObject({ rank: 1, title: 'In Rainbows', playCount: 412 });
    // A shorter period has fewer plays.
    expect(month.albums[0]?.playCount).toBeLessThan(100);
  });
});

describe('GET /api/streaming/price', () => {
  it('finds the vinyl pressing and its cheapest copy', async () => {
    const ctx = setup();

    const res = await ctx.alex
      .get('/api/streaming/price')
      .query({ artist: 'Miles Davis', title: 'Kind of Blue (Legacy Edition)' });

    expect(res.status).toBe(200);
    expect(vinylPriceSchema.parse(res.body)).toEqual({
      found: true,
      releaseId: KIND_OF_BLUE_RELEASE_ID,
      releaseTitle: 'Miles Davis - Kind Of Blue',
      lowestPrice: 24.99,
      currency: 'USD',
      numForSale: 37,
    });
    // Searched for vinyl by artist and plain title (no "Legacy Edition").
    const search = ctx.discogs.requests[0]?.url.searchParams;
    expect(search?.get('artist')).toBe('Miles Davis');
    expect(search?.get('release_title')).toBe('Kind of Blue');
    expect(search?.get('format')).toBe('Vinyl');
  });

  it('compares the top three pressings and picks the cheapest with copies for sale', async () => {
    const db = createDb(':memory:');
    const discogs = fakeDiscogs({
      // The first pressing found costs 24.99 (the default); the second is cheaper;
      // the third has nothing for sale.
      '/marketplace/stats/2825456': () =>
        Response.json({ lowest_price: { currency: 'USD', value: 19.5 }, num_for_sale: 12 }),
      '/marketplace/stats/7606066': () => Response.json({ lowest_price: null, num_for_sale: 0 }),
    });
    const alex = loggedIn(createApp({ db, discogs: discogs.client }), addUser(db, 'alex').cookie);

    const res = await alex
      .get('/api/streaming/price')
      .query({ artist: 'Miles Davis', title: 'Kind of Blue' });

    expect(vinylPriceSchema.parse(res.body)).toMatchObject({
      found: true,
      releaseId: 2825456,
      lowestPrice: 19.5,
      numForSale: 12,
    });
    // One search plus three price checks, and no more.
    expect(discogs.requests.map((r) => r.url.pathname)).toEqual([
      '/database/search',
      '/marketplace/stats/2772432',
      '/marketplace/stats/2825456',
      '/marketplace/stats/7606066',
    ]);
  });

  it('reports the problem when Discogs cannot give any price at all', async () => {
    const db = createDb(':memory:');
    const busy = () => Response.json({ message: 'Too many requests' }, { status: 429 });
    const discogs = fakeDiscogs({
      '/marketplace/stats/2772432': busy,
      '/marketplace/stats/2825456': busy,
      '/marketplace/stats/7606066': busy,
    });
    const alex = loggedIn(createApp({ db, discogs: discogs.client }), addUser(db, 'alex').cookie);

    const res = await alex
      .get('/api/streaming/price')
      .query({ artist: 'Miles Davis', title: 'Kind of Blue' });

    expect(res.status).toBe(503);
    expect(code(res.body)).toBe('DISCOGS_BUSY');
  });

  it('says so when Discogs has no vinyl pressing, or none for sale', async () => {
    const none = { pagination: { page: 1, pages: 1 }, results: [] };
    const db = createDb(':memory:');
    const noPressing = loggedIn(
      createApp({
        db,
        discogs: fakeDiscogs({ '/database/search': () => Response.json(none) }).client,
      }),
      addUser(db, 'alex').cookie,
    );
    const noCopies = loggedIn(
      createApp({
        db,
        discogs: fakeDiscogs({
          [`/marketplace/stats/${KIND_OF_BLUE_RELEASE_ID}`]: () =>
            Response.json({ lowest_price: null, num_for_sale: 0 }),
        }).client,
      }),
      addUser(db, 'blair').cookie,
    );
    const query = { artist: 'Nobody', title: 'Nothing' };

    expect((await noPressing.get('/api/streaming/price').query(query)).body).toMatchObject({
      found: false,
      lowestPrice: null,
      numForSale: 0,
    });
    expect((await noCopies.get('/api/streaming/price').query(query)).body).toMatchObject({
      found: true,
      lowestPrice: null,
      currency: null,
      numForSale: 0,
    });
  });

  it('needs an artist and a title, and Discogs to be set up', async () => {
    const ctx = setup();
    expect((await ctx.alex.get('/api/streaming/price').query({ artist: 'Only' })).status).toBe(400);

    const db = createDb(':memory:');
    const noDiscogs = loggedIn(createApp({ db }), addUser(db, 'alex').cookie);
    const res = await noDiscogs.get('/api/streaming/price').query({ artist: 'A', title: 'B' });
    expect(res.status).toBe(503);
    expect(code(res.body)).toBe('DISCOGS_NOT_CONFIGURED');
  });
});

describe('the wishlist', () => {
  let ctx: ReturnType<typeof setup>;

  beforeEach(() => {
    ctx = setup();
  });

  const IN_RAINBOWS = {
    title: 'In Rainbows',
    artist: 'Radiohead',
    coverImageUrl: 'https://example.com/in-rainbows.png',
    playCount: 412,
  };

  it('adds albums and lists them newest first', async () => {
    const first = await ctx.alex.post('/api/wishlist').send(IN_RAINBOWS);
    await ctx.alex.post('/api/wishlist').send({ title: ' Blonde ', artist: 'Frank Ocean' });

    expect(first.status).toBe(201);
    expect(wishlistItemSchema.parse(first.body)).toMatchObject(IN_RAINBOWS);
    const { items } = wishlistSchema.parse((await ctx.alex.get('/api/wishlist')).body);
    expect(items.map((i) => i.title)).toEqual(['Blonde', 'In Rainbows']);
    expect(items[0]).toMatchObject({ coverImageUrl: null, playCount: null });
  });

  it("doesn't add the same album twice, whatever the capitals", async () => {
    const first = await ctx.alex.post('/api/wishlist').send(IN_RAINBOWS);
    const again = await ctx.alex
      .post('/api/wishlist')
      .send({ title: 'IN RAINBOWS', artist: 'radiohead' });

    expect(again.status).toBe(200);
    expect(again.body.id).toBe(first.body.id);
    expect((await ctx.alex.get('/api/wishlist')).body.items).toHaveLength(1);
  });

  it('removes an album', async () => {
    const { id } = (await ctx.alex.post('/api/wishlist').send(IN_RAINBOWS)).body;

    expect((await ctx.alex.delete(`/api/wishlist/${id}`)).status).toBe(204);
    expect((await ctx.alex.get('/api/wishlist')).body.items).toEqual([]);
    expect((await ctx.alex.delete(`/api/wishlist/${id}`)).status).toBe(404);
  });

  it('explains what is missing', async () => {
    const res = await ctx.alex.post('/api/wishlist').send({ title: '', coverImageUrl: 'nope' });

    expect(res.status).toBe(400);
    const { message } = apiErrorSchema.parse(res.body).error;
    expect(message).toContain('title: title is required');
    expect(message).toContain('artist');
    expect(message).toContain('coverImageUrl: Enter a full web address');
  });

  it('is kept separately for each account', async () => {
    const { id } = (await ctx.alex.post('/api/wishlist').send(IN_RAINBOWS)).body;

    expect((await ctx.blair.get('/api/wishlist')).body.items).toEqual([]);
    expect((await ctx.blair.delete(`/api/wishlist/${id}`)).status).toBe(404);
    // Blair can wish for the same album without touching Alex's.
    expect((await ctx.blair.post('/api/wishlist').send(IN_RAINBOWS)).status).toBe(201);
    expect((await ctx.alex.get('/api/wishlist')).body.items).toHaveLength(1);
  });
});
