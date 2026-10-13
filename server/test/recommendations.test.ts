// ============================================================================
// recommendations.test.ts: TESTS FOR RECOMMENDATIONS
//
// Most tests use a pretend Last.fm that answers from two small lists (who is
// similar to whom, and each artist's albums), so every expected suggestion can
// be worked out by hand. The Last.fm client itself is tested against real
// answers recorded from Last.fm (test/fixtures/lastfm/).
// ============================================================================

import { readFileSync } from 'node:fs';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { apiErrorSchema, recommendationsSchema, type RecordInput } from '@vinyl/shared';
import { createApp } from '../src/app.js';
import { createDb } from '../src/db/client.js';
import { LastfmClient, LastfmError, type LastfmSource } from '../src/integrations/lastfm/client.js';
import { sampleLastfm } from '../src/integrations/lastfm/sample.js';
import { pickKeyArtists } from '../src/services/recommendations.js';
import { listRecords } from '../src/services/records.js';
import { addUser, loggedIn, recordInput } from './helpers.js';

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`./fixtures/lastfm/${name}`, import.meta.url), 'utf8'));
}

type Similar = Record<string, [string, number][]>;
type Albums = Record<string, string[]>;

/** A pretend Last.fm. Artists listed in `failing` make it throw, like an outage. */
function pretendLastfm(similar: Similar, albums: Albums, failing: string[] = []) {
  const asked: string[] = [];
  const check = (artist: string) => {
    if (failing.includes(artist)) {
      throw new LastfmError(502, 'LASTFM_UNAVAILABLE', "Couldn't reach Last.fm. Try again later.");
    }
  };
  const source: LastfmSource = {
    sampleArtists: false,
    isSample: () => false,
    getTopAlbums: () => Promise.resolve([]),
    // Scrobbling isn't used by recommendations.
    canScrobble: false,
    authorizeUrl: () => '',
    getSession: () => Promise.reject(new Error('not used')),
    scrobble: () => Promise.reject(new Error('not used')),
    getSimilarArtists: async (artist) => {
      asked.push(`similar:${artist}`);
      check(artist);
      return (similar[artist] ?? []).map(([name, match]) => ({ name, match }));
    },
    getArtistTopAlbums: async (artist) => {
      asked.push(`albums:${artist}`);
      check(artist);
      return (albums[artist] ?? []).map((title) => ({
        title,
        artist,
        coverImageUrl: `https://example.com/${encodeURIComponent(title)}.png`,
        url: null,
      }));
    },
  };
  return { source, asked };
}

const SIMILAR: Similar = {
  'Miles Davis': [
    ['John Coltrane', 1], // already on the shelf
    ['Miles Davis Quintet', 0.95], // Miles Davis again
    ['Charles Mingus', 0.8],
    ['Herbie Hancock', 0.7],
  ],
  'John Coltrane': [
    ['Miles Davis', 1],
    ['Charles Mingus', 0.85],
    ['Thelonious Monk', 0.8],
  ],
};

const ALBUMS: Albums = {
  'Charles Mingus': ['Greatest Hits', 'Mingus Ah Um', 'The Black Saint and the Sinner Lady'],
  'Herbie Hancock': ['Head Hunters'],
  'Thelonious Monk': ["Monk's Dream"],
};

function setup(lastfm: LastfmSource | null) {
  const db = createDb(':memory:');
  const app = createApp({ db, lastfm });
  const alexUser = addUser(db, 'alex');
  const alex = loggedIn(app, alexUser.cookie);
  const blair = loggedIn(app, addUser(db, 'blair').cookie);
  const add = async (who: typeof alex, title: string, overrides: Partial<RecordInput>) =>
    (await who.post('/api/records').send(recordInput({ title, ...overrides }))).body.id as number;
  return { db, app, alex, blair, add, alexId: alexUser.user.id };
}

/** Alex's shelf: two Miles Davis records (one loved) and one John Coltrane. */
async function jazzShelf(ctx: ReturnType<typeof setup>) {
  const kob = await ctx.add(ctx.alex, 'Kind of Blue', { artists: ['Miles Davis'] });
  await ctx.add(ctx.alex, 'Bitches Brew', { artists: ['Miles Davis'] });
  await ctx.add(ctx.alex, 'Blue Train', { artists: ['John Coltrane'] });
  await ctx.alex.put(`/api/records/${kob}/review`).send({ rating: 5 });
}

const recommend = async (who: ReturnType<typeof setup>['alex']) => {
  const res = await who.get('/api/recommendations');
  expect(res.status).toBe(200);
  return recommendationsSchema.parse(res.body);
};

describe('picking the shelf’s key artists', () => {
  it('counts records owned, plays and ratings', async () => {
    const ctx = setup(null);
    await jazzShelf(ctx);
    const loved = await ctx.add(ctx.alex, 'Blue', { artists: ['Joni Mitchell'] });
    await ctx.alex.put(`/api/records/${loved}/review`).send({ rating: 5 });
    for (let i = 0; i < 5; i++) {
      await ctx.alex.post('/api/spins').send({ recordId: loved, durationSeconds: 600 });
    }

    const key = pickKeyArtists(listRecords(ctx.db, ctx.alexId, { sort: 'added' }));

    // Miles Davis: two records (1 + 0 + 1) + (1 + 0 + 0.5) = 3.5 points.
    // Joni Mitchell: one record, played 5 times, 5 stars = 3 points.
    // John Coltrane: one unrated, unplayed record = 1.5 points.
    expect(key.map((a) => a.name)).toEqual(['Miles Davis', 'Joni Mitchell', 'John Coltrane']);
    expect(key[0]?.weight).toBe(1);
    expect(key[1]?.weight).toBeCloseTo(3 / 3.5);
    expect(key[2]?.weight).toBeCloseTo(1.5 / 3.5);
  });

  it('uses at most six artists', async () => {
    const ctx = setup(null);
    for (let i = 1; i <= 8; i++) {
      await ctx.add(ctx.alex, `Album ${i}`, { artists: [`Artist ${i}`] });
    }

    expect(pickKeyArtists(listRecords(ctx.db, ctx.alexId, { sort: 'added' }))).toHaveLength(6);
  });
});

describe('GET /api/recommendations', () => {
  let ctx: ReturnType<typeof setup>;
  let lastfm: ReturnType<typeof pretendLastfm>;

  beforeEach(async () => {
    lastfm = pretendLastfm(SIMILAR, ALBUMS);
    ctx = setup(lastfm.source);
    await jazzShelf(ctx);
  });

  it('suggests albums by similar artists, taking turns between the shelf’s artists', async () => {
    const result = await recommend(ctx.alex);

    expect(result.basedOn).toEqual(['Miles Davis', 'John Coltrane']);
    expect(result.sample).toBe(false);
    expect(result.recommendations.map((r) => [r.artist, r.title, r.because])).toEqual([
      // Miles Davis's turn: Charles Mingus is first in line (he's similar to both artists).
      ['Charles Mingus', 'Mingus Ah Um', ['Miles Davis', 'John Coltrane']],
      // John Coltrane's turn: Mingus is taken, so the next in his line.
      ['Thelonious Monk', "Monk's Dream", ['John Coltrane']],
      // Miles Davis's second turn.
      ['Herbie Hancock', 'Head Hunters', ['Miles Davis']],
    ]);
    expect(result.recommendations[0]?.coverImageUrl).toBe(
      'https://example.com/Mingus%20Ah%20Um.png',
    );
  });

  it('never suggests artists already on the shelf, or the same artist under a longer name', async () => {
    const artists = (await recommend(ctx.alex)).recommendations.map((r) => r.artist);

    expect(artists).not.toContain('John Coltrane');
    expect(artists).not.toContain('Miles Davis');
    expect(artists).not.toContain('Miles Davis Quintet');
    // And it didn't waste a request asking for their albums.
    expect(lastfm.asked).not.toContain('albums:Miles Davis Quintet');
  });

  it('skips "greatest hits" collections and picks a proper album', async () => {
    const mingus = (await recommend(ctx.alex)).recommendations[0];

    expect(mingus?.title).toBe('Mingus Ah Um');
  });

  it('skips singles and shows the plain album name without edition labels', async () => {
    lastfm = pretendLastfm(SIMILAR, {
      ...ALBUMS,
      'Herbie Hancock': [
        'Rockit (with Someone Else)',
        'Chameleon feat. Nobody',
        'Head Hunters (Remastered)',
      ],
      'Thelonious Monk': ["Monk's Dream (Extended Version)"],
    });
    ctx = setup(lastfm.source);
    await jazzShelf(ctx);

    const titles = (await recommend(ctx.alex)).recommendations.map((r) => r.title);

    expect(titles).toEqual(['Mingus Ah Um', "Monk's Dream", 'Head Hunters']);
  });

  it('gives every artist on the shelf a turn, so a favorite cannot fill the list', async () => {
    const many: [string, number][] = ['One', 'Two', 'Three'].map((n, i) => [
      `Jazz Artist ${n}`,
      0.9 - i * 0.1,
    ]);
    lastfm = pretendLastfm(
      // John Coltrane counts for less (one unrated record) and his match is weaker...
      { 'Miles Davis': many, 'John Coltrane': [['Thelonious Monk', 0.5]] },
      {
        ...Object.fromEntries(many.map(([name]) => [name, [`Album by ${name}`]])),
        'Thelonious Monk': ["Monk's Dream"],
      },
    );
    ctx = setup(lastfm.source);
    await jazzShelf(ctx);

    const result = await recommend(ctx.alex);

    // ...but his suggestion still comes second, before Miles Davis's second one.
    expect(result.recommendations.map((r) => [r.artist, r.because[0]])).toEqual([
      ['Jazz Artist One', 'Miles Davis'],
      ['Thelonious Monk', 'John Coltrane'],
      ['Jazz Artist Two', 'Miles Davis'],
      ['Jazz Artist Three', 'Miles Davis'],
    ]);
  });

  it('moves on to the next similar artist when the closest ones are owned or have no album', async () => {
    lastfm = pretendLastfm(
      {
        'Miles Davis': [
          ['John Coltrane', 1], // on the shelf
          ['Miles Davis Quintet', 0.95], // Miles Davis again
          ['No Albums Known', 0.9], // Last.fm knows no album of theirs
          ['Only Compilations', 0.8], // nothing but a greatest hits
          ['Next In Line', 0.3],
        ],
      },
      {
        'No Albums Known': [],
        'Only Compilations': ['Greatest Hits'],
        'Next In Line': ['A Fine Album'],
      },
    );
    ctx = setup(lastfm.source);
    await jazzShelf(ctx);

    const result = await recommend(ctx.alex);

    expect(result.recommendations.map((r) => [r.artist, r.title, r.because])).toEqual([
      ['Next In Line', 'A Fine Album', ['Miles Davis']],
    ]);
  });

  it('stops at ten suggestions', async () => {
    const many: [string, number][] = Array.from({ length: 14 }, (_, i) => [
      `Artist ${String(i + 1).padStart(2, '0')}`,
      0.9 - i * 0.01,
    ]);
    lastfm = pretendLastfm(
      { 'Miles Davis': many },
      Object.fromEntries(many.map(([name]) => [name, [`Album by ${name}`]])),
    );
    ctx = setup(lastfm.source);
    await ctx.add(ctx.alex, 'Kind of Blue', { artists: ['Miles Davis'] });

    const result = await recommend(ctx.alex);

    expect(result.recommendations).toHaveLength(10);
    expect(result.recommendations[0]?.artist).toBe('Artist 01');
    // Albums were only looked up for the front of the line (10 + 2 spare), not all 14.
    expect(lastfm.asked.filter((q) => q.startsWith('albums:'))).toHaveLength(12);
  });

  it('leaves out an artist when Last.fm knows none of their albums', async () => {
    lastfm = pretendLastfm(SIMILAR, { ...ALBUMS, 'Herbie Hancock': [] });
    ctx = setup(lastfm.source);
    await jazzShelf(ctx);

    const artists = (await recommend(ctx.alex)).recommendations.map((r) => r.artist);

    expect(artists).toEqual(['Charles Mingus', 'Thelonious Monk']);
  });

  it('marks albums that are already on the wishlist', async () => {
    const { id } = (
      await ctx.alex.post('/api/wishlist').send({ title: 'head hunters', artist: 'Herbie Hancock' })
    ).body;

    const result = await recommend(ctx.alex);

    expect(result.recommendations.map((r) => r.wishlistItemId)).toEqual([null, null, id]);
  });

  it('is based on your own shelf only', async () => {
    await ctx.add(ctx.blair, 'Rumours', { artists: ['Fleetwood Mac'] });

    const forBlair = await recommend(ctx.blair);

    expect(forBlair.basedOn).toEqual(['Fleetwood Mac']);
    expect(forBlair.recommendations).toEqual([]);
    expect((await recommend(ctx.alex)).basedOn).not.toContain('Fleetwood Mac');
  });

  it('has nothing to suggest for an empty shelf, and asks Last.fm nothing', async () => {
    const result = await recommend(ctx.blair);

    expect(result).toEqual({ recommendations: [], basedOn: [], sample: false });
    expect(lastfm.asked).toEqual([]);
  });

  it('still works when Last.fm fails for some artists', async () => {
    lastfm = pretendLastfm(SIMILAR, ALBUMS, ['John Coltrane', 'Herbie Hancock']);
    ctx = setup(lastfm.source);
    await jazzShelf(ctx);

    const result = await recommend(ctx.alex);

    // Only Miles Davis's similar artists arrived, and Herbie Hancock's albums didn't.
    expect(result.recommendations.map((r) => r.artist)).toEqual(['Charles Mingus']);
    expect(result.recommendations[0]?.because).toEqual(['Miles Davis']);
  });

  it('reports the problem when Last.fm fails for every artist', async () => {
    lastfm = pretendLastfm(SIMILAR, ALBUMS, ['Miles Davis', 'John Coltrane']);
    ctx = setup(lastfm.source);
    await jazzShelf(ctx);

    const res = await ctx.alex.get('/api/recommendations');

    expect(res.status).toBe(502);
    expect(apiErrorSchema.parse(res.body).error.code).toBe('LASTFM_UNAVAILABLE');
  });

  it('needs a login, and Last.fm to be set up', async () => {
    expect((await request(ctx.app).get('/api/recommendations')).status).toBe(401);

    const noLastfm = setup(null);
    const res = await noLastfm.alex.get('/api/recommendations');
    expect(res.status).toBe(503);
    expect(apiErrorSchema.parse(res.body).error.code).toBe('LASTFM_NOT_CONFIGURED');
  });

  it('uses built-in sample artists on a demo without a Last.fm key, and says so', async () => {
    ctx = setup(sampleLastfm());
    await jazzShelf(ctx);

    const result = await recommend(ctx.alex);

    expect(result.sample).toBe(true);
    expect(result.recommendations[0]).toMatchObject({
      artist: 'Charles Mingus',
      title: 'Mingus Ah Um',
      because: ['Miles Davis', 'John Coltrane'],
    });
  });
});

describe('the Last.fm client: similar artists and their albums', () => {
  function client(answer: () => Response) {
    const requests: URL[] = [];
    const lastfm = new LastfmClient({
      apiKey: 'test-key',
      userAgent: 'VinylTrackerTests/1.0',
      fetch: (async (input: string | URL | Request) => {
        requests.push(new URL(String(input)));
        return answer();
      }) as typeof fetch,
    });
    return { lastfm, requests };
  }

  it('reads similar artists, the most similar first', async () => {
    const { lastfm, requests } = client(() => Response.json(fixture('similar-miles-davis.json')));

    const similar = await lastfm.getSimilarArtists('Miles Davis');

    expect(requests[0]?.searchParams.get('method')).toBe('artist.getsimilar');
    expect(requests[0]?.searchParams.get('artist')).toBe('Miles Davis');
    expect(similar).toHaveLength(5);
    // "match" arrives as text ("1"); it's turned into a number from 0 to 1.
    expect(similar[0]).toEqual({ name: 'John Coltrane', match: 1 });
    expect(similar.every((s) => s.match > 0 && s.match <= 1)).toBe(true);
  });

  it("reads an artist's best-known albums", async () => {
    const { lastfm, requests } = client(() =>
      Response.json(fixture('artist-top-albums-john-coltrane.json')),
    );

    const albums = await lastfm.getArtistTopAlbums('John Coltrane');

    expect(requests[0]?.searchParams.get('method')).toBe('artist.gettopalbums');
    expect(albums.slice(0, 2).map((a) => a.title)).toEqual(['Blue Train', 'A Love Supreme']);
    expect(albums[0]).toMatchObject({
      artist: 'John Coltrane',
      url: 'https://www.last.fm/music/John+Coltrane/Blue+Train',
    });
    expect(albums[0]?.coverImageUrl).toMatch(/^https:\/\/.+300x300/);
  });

  it('treats an artist Last.fm does not know as having nothing similar', async () => {
    // Last.fm answers "not found" with status 200 and an error number inside.
    const { lastfm } = client(() => Response.json(fixture('artist-not-found.json')));

    expect(await lastfm.getSimilarArtists('No Such Artist')).toEqual([]);
    expect(await lastfm.getArtistTopAlbums('No Such Artist')).toEqual([]);
  });

  it('remembers answers, so the same question is only asked once', async () => {
    const { lastfm, requests } = client(() => Response.json(fixture('similar-miles-davis.json')));

    await lastfm.getSimilarArtists('Miles Davis');
    await lastfm.getSimilarArtists('miles davis');

    expect(requests).toHaveLength(1);
  });
});
