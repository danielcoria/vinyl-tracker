// ============================================================================
// scrobbling.test.ts: TESTS FOR SENDING VINYL PLAYS TO LAST.FM
//
// Three parts:
//   1. the Last.fm client's signed requests (checked against the network
//      request it would send; nothing really leaves the computer)
//   2. working out which songs a play covers and when each one started
//   3. the whole flow through the app with a pretend Last.fm: connecting an
//      account, then what happens to plays (sent, waiting, skipped, failed)
// ============================================================================

import { createHash } from 'node:crypto';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { scrobblingStatusSchema, spinSchema, type RecordInput } from '@vinyl/shared';
import { createApp } from '../src/app.js';
import { createDb } from '../src/db/client.js';
import { seedDemoData } from '../src/db/demo.js';
import { lastfmAccounts, spins } from '../src/db/schema.js';
import {
  LastfmClient,
  LastfmError,
  type LastfmSource,
  type ScrobbleTrack,
} from '../src/integrations/lastfm/client.js';
import { getSettings } from '../src/services/settings.js';
import { scrobbleDue, tracksToScrobble } from '../src/services/scrobbling.js';
import { replaceTracks } from '../src/services/tracks.js';
import { addUser, loggedIn, recordInput } from './helpers.js';

const MIN = 60;
const DAY = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// 1. The client's signed requests
// ---------------------------------------------------------------------------

/** Pass null as the secret for a server that has only the API key. */
function signingClient(answer: () => Response, sharedSecret: string | null = 'the-secret') {
  const requests: { url: string; method: string; body: URLSearchParams }[] = [];
  const client = new LastfmClient({
    apiKey: 'the-key',
    sharedSecret: sharedSecret ?? undefined,
    userAgent: 'VinylTrackerTests/1.0',
    fetch: (async (input: string | URL | Request, init: RequestInit = {}) => {
      requests.push({
        url: String(input),
        method: init.method ?? 'GET',
        body: new URLSearchParams(String(init.body ?? '')),
      });
      return answer();
    }) as typeof fetch,
  });
  return { client, requests };
}

const md5 = (text: string) => createHash('md5').update(text, 'utf8').digest('hex');

describe('the Last.fm client: scrobbling requests', () => {
  it('builds the approval address with the API key and where to come back to', () => {
    const { client } = signingClient(() => Response.json({}));

    const url = new URL(client.authorizeUrl('https://example.com/api/lastfm/callback?state=abc'));

    expect(url.origin + url.pathname).toBe('https://www.last.fm/api/auth/');
    expect(url.searchParams.get('api_key')).toBe('the-key');
    expect(url.searchParams.get('cb')).toBe('https://example.com/api/lastfm/callback?state=abc');
    // The secret never appears in an address.
    expect(url.toString()).not.toContain('the-secret');
  });

  it('swaps a token for a session, signing the request the way Last.fm requires', async () => {
    const { client, requests } = signingClient(() =>
      Response.json({ session: { name: 'vinyl_fan', key: 'session-key-123', subscriber: 0 } }),
    );

    const session = await client.getSession('one-time-token');

    expect(session).toEqual({ username: 'vinyl_fan', sessionKey: 'session-key-123' });
    const sent = requests[0];
    expect(sent?.method).toBe('POST');
    expect(Object.fromEntries(sent?.body ?? [])).toMatchObject({
      method: 'auth.getSession',
      token: 'one-time-token',
      api_key: 'the-key',
      format: 'json',
    });
    // Last.fm's recipe: every parameter as name+value in alphabetical order (without
    // "format"), then the secret, through MD5.
    expect(sent?.body.get('api_sig')).toBe(
      md5('api_keythe-keymethodauth.getSessiontokenone-time-tokenthe-secret'),
    );
    // The secret itself is never sent, only the fingerprint made with it.
    expect(sent?.body.toString()).not.toContain('the-secret');
  });

  it('numbers the songs of a scrobble and reports how many were accepted', async () => {
    const { client, requests } = signingClient(() =>
      Response.json({ scrobbles: { '@attr': { accepted: 2, ignored: 0 }, scrobble: [] } }),
    );
    const tracks: ScrobbleTrack[] = [
      {
        artist: 'Miles Davis',
        track: 'So What',
        album: 'Kind of Blue',
        timestamp: 1000,
        duration: 536,
      },
      {
        artist: 'Miles Davis',
        track: 'Blue in Green',
        album: 'Kind of Blue',
        timestamp: 1536,
        duration: null,
      },
    ];

    const result = await client.scrobble('session-key-123', tracks);

    expect(result).toEqual({ accepted: 2 });
    const body = Object.fromEntries(requests[0]?.body ?? []);
    expect(body).toMatchObject({
      method: 'track.scrobble',
      sk: 'session-key-123',
      'artist[0]': 'Miles Davis',
      'track[0]': 'So What',
      'album[0]': 'Kind of Blue',
      'timestamp[0]': '1000',
      'duration[0]': '536',
      'track[1]': 'Blue in Green',
      'timestamp[1]': '1536',
    });
    // An unknown length is left out rather than sent as nothing.
    expect(body).not.toHaveProperty('duration[1]');
  });

  it('sends nothing when there is nothing to scrobble', async () => {
    const { client, requests } = signingClient(() => Response.json({}));

    expect(await client.scrobble('session-key-123', [])).toEqual({ accepted: 0 });
    expect(requests).toEqual([]);
  });

  it('turns Last.fm’s refusals into clear errors', async () => {
    const cases: [number, number, string][] = [
      [9, 401, 'LASTFM_SESSION_INVALID'], // the person removed the app on Last.fm
      [4, 400, 'LASTFM_TOKEN_INVALID'],
      [14, 400, 'LASTFM_TOKEN_INVALID'],
      [13, 502, 'LASTFM_AUTH'], // wrong shared secret
      [29, 503, 'LASTFM_BUSY'],
      [16, 502, 'LASTFM_UNAVAILABLE'], // "try again later"
    ];
    for (const [error, status, code] of cases) {
      const { client } = signingClient(() => Response.json({ error, message: 'x' }));
      await expect(client.getSession('token'), `error ${error}`).rejects.toMatchObject({
        status,
        code,
      });
    }
  });

  it('says scrobbling is not set up without the shared secret, and asks Last.fm nothing', async () => {
    const { client, requests } = signingClient(() => Response.json({}), null);

    expect(client.canScrobble).toBe(false);
    await expect(client.getSession('token')).rejects.toMatchObject({
      status: 503,
      code: 'LASTFM_SCROBBLING_NOT_CONFIGURED',
    });
    expect(requests).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 2. Which songs, and when
// ---------------------------------------------------------------------------

describe('the songs of a play', () => {
  const album = { title: 'Kind of Blue', artist: 'Miles Davis' };
  const start = '2026-10-10T20:00:00.000Z';
  const startSeconds = Date.parse(start) / 1000;

  it('each start when the one before it ends', () => {
    const tracks = tracksToScrobble({ playedAt: start, durationSeconds: 1435 }, album, [
      { title: 'So What', durationSeconds: 536 },
      { title: 'Freddie Freeloader', durationSeconds: 572 },
      { title: 'Blue In Green', durationSeconds: 327 },
    ]);

    expect(tracks.map((t) => [t.track, t.timestamp - startSeconds, t.duration])).toEqual([
      ['So What', 0, 536],
      ['Freddie Freeloader', 536, 572],
      ['Blue In Green', 1108, 327],
    ]);
    expect(tracks[0]).toMatchObject({ artist: 'Miles Davis', album: 'Kind of Blue' });
  });

  it('share the leftover time between songs whose length is unknown', () => {
    // A 20-minute play: one 8-minute song, and two of unknown length (6 minutes each).
    const tracks = tracksToScrobble({ playedAt: start, durationSeconds: 20 * MIN }, album, [
      { title: 'Known', durationSeconds: 8 * MIN },
      { title: 'Unknown One', durationSeconds: null },
      { title: 'Unknown Two', durationSeconds: null },
    ]);

    expect(tracks.map((t) => t.timestamp - startSeconds)).toEqual([0, 8 * MIN, 14 * MIN]);
    expect(tracks.map((t) => t.duration)).toEqual([8 * MIN, null, null]);
  });

  it('leave out songs under 30 seconds (Last.fm ignores them) but keep the clock moving', () => {
    const tracks = tracksToScrobble({ playedAt: start, durationSeconds: 400 }, album, [
      { title: 'Intro', durationSeconds: 20 },
      { title: 'The Song', durationSeconds: 380 },
    ]);

    expect(tracks.map((t) => [t.track, t.timestamp - startSeconds])).toEqual([['The Song', 20]]);
  });
});

// ---------------------------------------------------------------------------
// 3. The whole flow, with a pretend Last.fm
// ---------------------------------------------------------------------------

type Mode = 'ok' | 'down' | 'removed' | 'ignores';

function pretendLastfm({ canScrobble = true } = {}) {
  const state = { mode: 'ok' as Mode };
  const scrobbled: { sessionKey: string; tracks: ScrobbleTrack[] }[] = [];
  const source: LastfmSource = {
    sampleArtists: false,
    isSample: () => false,
    getTopAlbums: () => Promise.resolve([]),
    getSimilarArtists: () => Promise.resolve([]),
    getArtistTopAlbums: () => Promise.resolve([]),
    canScrobble,
    authorizeUrl: (callback) =>
      `https://last.example/auth?${new URLSearchParams({ cb: callback })}`,
    // The pretend Last.fm accepts tokens like "token-for-<username>".
    getSession: async (token) => {
      const username = token.match(/^token-for-(\w+)$/)?.[1];
      if (!username) {
        throw new LastfmError(
          400,
          'LASTFM_TOKEN_INVALID',
          "Last.fm didn't confirm the connection.",
        );
      }
      return { username, sessionKey: `key-of-${username}` };
    },
    scrobble: async (sessionKey, tracks) => {
      if (state.mode === 'down') {
        throw new LastfmError(502, 'LASTFM_UNAVAILABLE', "Couldn't reach Last.fm.");
      }
      if (state.mode === 'removed') {
        throw new LastfmError(401, 'LASTFM_SESSION_INVALID', 'Connect to Last.fm again.');
      }
      scrobbled.push({ sessionKey, tracks });
      return { accepted: state.mode === 'ignores' ? 0 : tracks.length };
    },
  };
  return { source, scrobbled, state };
}

function setup(options: { canScrobble?: boolean; demo?: boolean } = {}) {
  const db = createDb(':memory:');
  const lastfm = pretendLastfm(options);
  const app = createApp({ db, lastfm: lastfm.source, demo: options.demo });
  const alexUser = addUser(db, 'alex');
  const alex = loggedIn(app, alexUser.cookie);
  const blair = loggedIn(app, addUser(db, 'blair').cookie);

  /**
   * Alex goes through connecting, as a browser would: /connect (which sets the
   * state cookie and redirects to Last.fm), then `finish()` for the trip back
   * to /callback with a token for `lastfmUsername`.
   */
  async function connect(_who: typeof alex, lastfmUsername: string) {
    const started = await alex.get('/api/lastfm/connect');
    const stateCookie = (started.headers['set-cookie'] as unknown as string[] | undefined)
      ?.map((c) => c.split(';')[0])
      .find((c) => c?.startsWith('vt_lastfm_state='));
    const callback = new URL(new URL(started.headers.location ?? '').searchParams.get('cb') ?? '');
    const finish = () =>
      // Both cookies a browser would send: the login, and the state from /connect.
      request(app)
        .get(`${callback.pathname}?token=token-for-${lastfmUsername}`)
        .set('Cookie', `${alexUser.cookie}; ${stateCookie ?? ''}`);
    return { started, stateCookie, callback, finish };
  }
  return {
    db,
    app,
    lastfm,
    alex,
    blair,
    alexId: alexUser.user.id,
    alexCookie: alexUser.cookie,
    connect,
  };
}

let ctx: ReturnType<typeof setup>;

beforeEach(() => {
  ctx = setup();
});

const status = async (who: ReturnType<typeof setup>['alex']) =>
  scrobblingStatusSchema.parse((await who.get('/api/lastfm/status')).body);

describe('connecting a Last.fm account', () => {
  it('starts disconnected, with scrobbling available', async () => {
    expect(await status(ctx.alex)).toEqual({
      available: true,
      unavailableReason: null,
      connected: false,
      username: null,
    });
  });

  it('sends the browser to Last.fm, then saves the connection when it comes back', async () => {
    const { started, callback, finish } = await ctx.connect(ctx.alex, 'vinyl_fan');

    // Step 1: off to Last.fm, with a return address on this site that carries a state value.
    expect(started.status).toBe(302);
    expect(started.headers.location).toMatch(/^https:\/\/last\.example\/auth\?cb=/);
    expect(callback.pathname).toMatch(/^\/api\/lastfm\/callback\/[\w-]{20,}$/);
    // No "?" in it, so Last.fm can simply add "?token=...".
    expect(callback.search).toBe('');

    // Step 2: back from Last.fm with a token.
    const back = await finish();

    expect(back.status).toBe(302);
    expect(back.headers.location).toBe('/streaming?scrobbling=connected');
    expect(await status(ctx.alex)).toEqual({
      available: true,
      unavailableReason: null,
      connected: true,
      username: 'vinyl_fan',
    });
    // "Streaming vs. shelf" now uses the same account.
    expect(getSettings(ctx.db, ctx.alexId).lastfmUsername).toBe('vinyl_fan');
  });

  it('keeps the session key on the server', async () => {
    await (await ctx.connect(ctx.alex, 'vinyl_fan')).finish();

    const res = await ctx.alex.get('/api/lastfm/status');

    expect(JSON.stringify(res.body)).not.toContain('key-of-vinyl_fan');
    expect(ctx.db.select().from(lastfmAccounts).get()?.sessionKey).toBe('key-of-vinyl_fan');
  });

  it('refuses a return that does not match the browser that started it', async () => {
    const { callback } = await ctx.connect(ctx.alex, 'vinyl_fan');
    const url = `${callback.pathname}?token=token-for-attacker`;

    // Someone else's link, opened without the state cookie, or with a different one.
    const noCookie = await ctx.alex.get(url);
    const wrongState = await request(ctx.app)
      .get('/api/lastfm/callback/made-up?token=token-for-attacker')
      .set('Cookie', `${ctx.alexCookie}; vt_lastfm_state=something-else`);

    for (const res of [noCookie, wrongState]) {
      expect(res.headers.location).toBe('/streaming?scrobbling=failed');
    }
    expect((await status(ctx.alex)).connected).toBe(false);
  });

  it('reports a failed connection when Last.fm does not confirm the token, or "No" was pressed', async () => {
    const { callback, stateCookie } = await ctx.connect(ctx.alex, 'vinyl_fan');
    const cookies = `${ctx.alexCookie}; ${stateCookie}`;

    const badToken = await request(ctx.app)
      .get(`${callback.pathname}?token=not-a-real-token`)
      .set('Cookie', cookies);
    expect(badToken.headers.location).toBe('/streaming?scrobbling=failed');

    // Pressing "No" on Last.fm sends the browser back without a token.
    const second = await ctx.connect(ctx.alex, 'vinyl_fan');
    const declined = await request(ctx.app)
      .get(second.callback.pathname)
      .set('Cookie', `${ctx.alexCookie}; ${second.stateCookie}`);
    expect(declined.headers.location).toBe('/streaming?scrobbling=failed');
    expect((await status(ctx.alex)).connected).toBe(false);
  });

  it('disconnects, forgetting the session key', async () => {
    await (await ctx.connect(ctx.alex, 'vinyl_fan')).finish();

    expect((await ctx.alex.delete('/api/lastfm/connection')).status).toBe(204);

    expect(await status(ctx.alex)).toEqual({
      available: true,
      unavailableReason: null,
      connected: false,
      username: null,
    });
    expect(ctx.db.select().from(lastfmAccounts).all()).toEqual([]);
  });

  it('sends visitors who are not logged in to the login page', async () => {
    expect((await request(ctx.app).get('/api/lastfm/connect')).headers.location).toBe('/login');
    expect((await request(ctx.app).get('/api/lastfm/callback?token=x')).headers.location).toBe(
      '/login',
    );
    expect((await request(ctx.app).get('/api/lastfm/status')).status).toBe(401);
    expect((await request(ctx.app).delete('/api/lastfm/connection')).status).toBe(401);
  });

  it('is unavailable without the shared secret', async () => {
    ctx = setup({ canScrobble: false });

    expect(await status(ctx.alex)).toMatchObject({
      available: false,
      unavailableReason: 'not-set-up',
    });
    const res = await ctx.alex.get('/api/lastfm/connect');
    expect(res.headers.location).toBe('/streaming?scrobbling=unavailable');
  });

  it('is unavailable for the shared demo account, but not for other accounts on the demo', async () => {
    const db = createDb(':memory:');
    seedDemoData(db);
    const app = createApp({ db, lastfm: pretendLastfm().source, demo: true });
    const demo = request.agent(app);
    await demo.post('/api/auth/demo').expect(200);
    const visitor = loggedIn(app, addUser(db, 'visitor').cookie);

    expect(scrobblingStatusSchema.parse((await demo.get('/api/lastfm/status')).body)).toMatchObject(
      {
        available: false,
        unavailableReason: 'demo-account',
      },
    );
    expect((await demo.get('/api/lastfm/connect')).headers.location).toBe(
      '/streaming?scrobbling=unavailable',
    );
    expect(
      scrobblingStatusSchema.parse((await visitor.get('/api/lastfm/status')).body).available,
    ).toBe(true);
  });
});

describe('scrobbling plays', () => {
  let kindOfBlue: number;

  /** Kind of Blue with its two sides: A (So What 9:00, Blue In Green 5:00) and B (All Blues 11:00). */
  async function addAlbum(who = ctx.alex, overrides: Partial<RecordInput> = {}) {
    const id = (
      await who
        .post('/api/records')
        .send(recordInput({ title: 'Kind of Blue', artists: ['Miles Davis'], ...overrides }))
    ).body.id as number;
    replaceTracks(ctx.db, id, [
      { position: 'A1', side: 'A', title: 'So What', durationSeconds: 9 * MIN, sortOrder: 0 },
      { position: 'A2', side: 'A', title: 'Blue In Green', durationSeconds: 5 * MIN, sortOrder: 1 },
      { position: 'B1', side: 'B', title: 'All Blues', durationSeconds: 11 * MIN, sortOrder: 2 },
    ]);
    return id;
  }
  const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
  const log = async (body: object, who = ctx.alex) => {
    const res = await who.post('/api/spins').send({ recordId: kindOfBlue, ...body });
    expect(res.status).toBe(201);
    return spinSchema.parse(res.body);
  };
  const stateOf = (spinId: number) =>
    ctx.db
      .select()
      .from(spins)
      .all()
      .find((s) => s.id === spinId)?.scrobbleState;

  beforeEach(async () => {
    await (await ctx.connect(ctx.alex, 'vinyl_fan')).finish();
    kindOfBlue = await addAlbum();
  });

  it('sends a finished play straight away, one song at a time with its start time', async () => {
    const playedAt = ago(60 * 60 * 1000); // an hour ago

    const spin = await log({ sides: ['A'], playedAt, durationSeconds: 14 * MIN });

    expect(spin.scrobble).toBe('sent');
    expect(ctx.lastfm.scrobbled).toHaveLength(1);
    const { sessionKey, tracks } = ctx.lastfm.scrobbled[0] ?? { sessionKey: '', tracks: [] };
    expect(sessionKey).toBe('key-of-vinyl_fan');
    const startSeconds = Math.floor(Date.parse(playedAt) / 1000);
    expect(tracks).toEqual([
      {
        artist: 'Miles Davis',
        track: 'So What',
        album: 'Kind of Blue',
        timestamp: startSeconds,
        duration: 9 * MIN,
      },
      {
        artist: 'Miles Davis',
        track: 'Blue In Green',
        album: 'Kind of Blue',
        timestamp: startSeconds + 9 * MIN,
        duration: 5 * MIN,
      },
    ]);
  });

  it('sends every song when the whole record was played', async () => {
    await log({ playedAt: ago(2 * 60 * 60 * 1000), durationSeconds: 25 * MIN });

    expect(ctx.lastfm.scrobbled[0]?.tracks.map((t) => t.track)).toEqual([
      'So What',
      'Blue In Green',
      'All Blues',
    ]);
  });

  it('keeps a play off Last.fm when asked to', async () => {
    const spin = await log({
      playedAt: ago(60 * 60 * 1000),
      durationSeconds: 25 * MIN,
      scrobble: false,
    });

    expect(spin.scrobble).toBeNull();
    expect(ctx.lastfm.scrobbled).toEqual([]);
  });

  it('does nothing for an account that is not connected', async () => {
    const id = await addAlbum(ctx.blair);

    const res = await ctx.blair
      .post('/api/spins')
      .send({ recordId: id, playedAt: ago(60 * 60 * 1000), durationSeconds: 25 * MIN });

    expect(res.body.scrobble).toBeNull();
    expect(ctx.lastfm.scrobbled).toEqual([]);
  });

  it('waits until a play that is "starting now" is over, then sends it', async () => {
    const spin = await log({ sides: ['A'], durationSeconds: 14 * MIN }); // starts now

    expect(spin.scrobble).toBe('pending');
    expect(ctx.lastfm.scrobbled).toEqual([]);

    // Ten minutes in: still playing.
    expect(
      await scrobbleDue(ctx.db, ctx.lastfm.source, { now: Date.now() + 10 * MIN * 1000 }),
    ).toBe(0);
    expect(stateOf(spin.id)).toBe('pending');

    // Fifteen minutes in: it's over.
    expect(
      await scrobbleDue(ctx.db, ctx.lastfm.source, { now: Date.now() + 15 * MIN * 1000 }),
    ).toBe(1);
    expect(stateOf(spin.id)).toBe('sent');
    expect(ctx.lastfm.scrobbled).toHaveLength(1);
  });

  it('never sends the same play twice', async () => {
    await log({ playedAt: ago(60 * 60 * 1000), durationSeconds: 25 * MIN });

    await scrobbleDue(ctx.db, ctx.lastfm.source);
    await scrobbleDue(ctx.db, ctx.lastfm.source);

    expect(ctx.lastfm.scrobbled).toHaveLength(1);
  });

  it('skips plays from more than two weeks ago, which Last.fm would refuse', async () => {
    const spin = await log({ playedAt: ago(15 * DAY), durationSeconds: 25 * MIN });

    expect(spin.scrobble).toBe('skipped');
    expect(ctx.lastfm.scrobbled).toEqual([]);
  });

  it('skips a record without a tracklist: there are no songs to send', async () => {
    const noTracks = (
      await ctx.alex.post('/api/records').send(recordInput({ title: 'Hand-Added' }))
    ).body.id as number;

    const res = await ctx.alex
      .post('/api/spins')
      .send({ recordId: noTracks, playedAt: ago(60 * 60 * 1000), durationSeconds: 30 * MIN });

    expect(res.body.scrobble).toBe('skipped');
    expect(ctx.lastfm.scrobbled).toEqual([]);
  });

  it('marks a play skipped when Last.fm accepts none of its songs', async () => {
    ctx.lastfm.state.mode = 'ignores';

    const spin = await log({ playedAt: ago(60 * 60 * 1000), durationSeconds: 25 * MIN });

    expect(spin.scrobble).toBe('skipped');
  });

  it('still logs the play when Last.fm is down, and sends it once Last.fm is back', async () => {
    ctx.lastfm.state.mode = 'down';

    const spin = await log({ playedAt: ago(60 * 60 * 1000), durationSeconds: 25 * MIN });

    // The play itself is saved; only the scrobble is waiting.
    expect(spin.scrobble).toBe('pending');
    expect((await ctx.alex.get('/api/spins')).body.spins).toHaveLength(1);

    ctx.lastfm.state.mode = 'ok';
    expect(await scrobbleDue(ctx.db, ctx.lastfm.source)).toBe(1);
    expect(stateOf(spin.id)).toBe('sent');
  });

  it('disconnects when the app was removed on Last.fm', async () => {
    ctx.lastfm.state.mode = 'removed';

    const spin = await log({ playedAt: ago(60 * 60 * 1000), durationSeconds: 25 * MIN });

    expect(spin.scrobble).toBe('failed');
    expect((await status(ctx.alex)).connected).toBe(false);
    // Later plays aren't marked for Last.fm any more.
    ctx.lastfm.state.mode = 'ok';
    expect(
      (await log({ playedAt: ago(30 * 60 * 1000), durationSeconds: 25 * MIN })).scrobble,
    ).toBeNull();
  });

  it('drops plays that were still waiting when the account is disconnected', async () => {
    const spin = await log({ durationSeconds: 25 * MIN }); // starts now: waiting
    expect(spin.scrobble).toBe('pending');

    await ctx.alex.delete('/api/lastfm/connection').expect(204);

    expect(stateOf(spin.id)).toBeNull();
    expect(
      await scrobbleDue(ctx.db, ctx.lastfm.source, { now: Date.now() + 60 * MIN * 1000 }),
    ).toBe(0);
    expect(ctx.lastfm.scrobbled).toEqual([]);
  });

  it('shows the state of each play in the diary', async () => {
    await log({ playedAt: ago(60 * 60 * 1000), durationSeconds: 25 * MIN });
    await log({ playedAt: ago(30 * 60 * 1000), durationSeconds: 25 * MIN, scrobble: false });

    const diary = (await ctx.alex.get('/api/spins')).body.spins as { scrobble: string | null }[];

    expect(diary.map((s) => s.scrobble)).toEqual([null, 'sent']); // newest first
  });
});
