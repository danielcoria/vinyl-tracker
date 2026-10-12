// ============================================================================
// suggestions.test.ts: TESTS FOR "WHAT SHOULD I PLAY TONIGHT?"
//
// First the time fitting on its own (which sides fit in N minutes), then the
// picking: moods, genre, records played too recently, Shuffle and variety.
// "Now" is fixed at noon on October 1st 2026 so the day counts never change.
// ============================================================================

import { beforeEach, describe, expect, it } from 'vitest';
import {
  apiErrorSchema,
  suggestionQuerySchema,
  suggestionsSchema,
  type RecordInput,
  type SuggestionQuery,
  type Track,
} from '@vinyl/shared';
import { getSuggestions, whatFits } from '../src/services/suggestions.js';
import { replaceTracks } from '../src/services/tracks.js';
import { makeTestApp, recordInput } from './helpers.js';

const NOW = Date.parse('2026-10-01T12:00:00.000Z');
const MIN = 60;

/** A tracklist with one track per side, each the given number of minutes long. */
function sides(...minutes: number[]): Track[] {
  return minutes.map((m, i) => {
    const side = String.fromCharCode(65 + i); // A, B, C...
    return {
      id: i + 1,
      position: `${side}1`,
      side,
      title: `Track ${side}`,
      durationSeconds: m * MIN,
    };
  });
}

describe('what fits in the time', () => {
  const doubleAlbum = sides(20, 20, 20, 20);
  const noRuntime = { runtimeSeconds: null };

  it('is the whole record when there is no limit, or it fits', () => {
    expect(whatFits(noRuntime, doubleAlbum, null)).toEqual({
      sides: null,
      durationSeconds: 80 * MIN,
    });
    expect(whatFits(noRuntime, doubleAlbum, 90 * MIN)).toEqual({
      sides: null,
      durationSeconds: 80 * MIN,
    });
  });

  it('is as many sides in a row as fit, when the whole record does not', () => {
    expect(whatFits(noRuntime, doubleAlbum, 45 * MIN)).toEqual({
      sides: ['A', 'B'],
      durationSeconds: 40 * MIN,
    });
    expect(whatFits(noRuntime, doubleAlbum, 25 * MIN)).toEqual({
      sides: ['A'],
      durationSeconds: 20 * MIN,
    });
  });

  it('prefers the run of sides that uses the time best', () => {
    // 36 minutes: A+B is 40 (too long), B+C is 35 (fits), so B+C beats B alone.
    expect(whatFits(noRuntime, sides(15, 25, 10), 36 * MIN)).toEqual({
      sides: ['B', 'C'],
      durationSeconds: 35 * MIN,
    });
  });

  it('is nothing when even the shortest side is too long', () => {
    expect(whatFits(noRuntime, doubleAlbum, 10 * MIN)).toBeNull();
  });

  it('uses the album length when there is no usable tracklist', () => {
    const album = { runtimeSeconds: 40 * MIN };
    expect(whatFits(album, [], 45 * MIN)).toEqual({ sides: null, durationSeconds: 40 * MIN });
    // Too long, and no sides to offer instead.
    expect(whatFits(album, [], 30 * MIN)).toBeNull();
    // No length known at all: only suggested when there's no time limit.
    expect(whatFits(noRuntime, [], 30 * MIN)).toBeNull();
    expect(whatFits(noRuntime, [], null)).toEqual({ sides: null, durationSeconds: null });
  });
});

describe('picking records', () => {
  let ctx: ReturnType<typeof makeTestApp>;

  beforeEach(() => {
    ctx = makeTestApp();
  });

  async function add(title: string, overrides: Partial<RecordInput> = {}): Promise<number> {
    const res = await ctx.api
      .post('/api/records')
      .send(recordInput({ title, artists: [`Artist of ${title}`], ...overrides }));
    return res.body.id;
  }
  const rate = (id: number, rating: number) =>
    ctx.api.put(`/api/records/${id}/review`).send({ rating }).expect(200);
  const playedDaysAgo = (id: number, days: number) =>
    ctx.api
      .post('/api/spins')
      .send({
        recordId: id,
        playedAt: new Date(NOW - days * 24 * 3600_000).toISOString(),
        durationSeconds: 1200,
      })
      .expect(201);
  const suggest = (query: SuggestionQuery = {}) =>
    getSuggestions(ctx.db, ctx.user.id, suggestionQuerySchema.parse(query), NOW);
  const titles = (query: SuggestionQuery = {}) =>
    suggest(query).suggestions.map((s) => s.record.title);

  it('suggests three, balancing dust and rating by default', async () => {
    const loved = await add('Loved and dusty');
    const fine = await add('Fine and recent');
    const meh = await add('Meh and dusty');
    const extra = await add('Low and recent');
    await rate(loved, 5);
    await rate(fine, 4);
    await rate(meh, 2);
    await rate(extra, 1);
    await playedDaysAgo(loved, 200);
    await playedDaysAgo(fine, 10);
    await playedDaysAgo(meh, 200);
    await playedDaysAgo(extra, 10);

    const result = suggest();

    expect(result.suggestions.map((s) => s.record.title)).toEqual([
      'Loved and dusty',
      'Meh and dusty',
      'Fine and recent',
    ]);
    expect(result.matchCount).toBe(4);
    expect(result.suggestions[0]).toMatchObject({ rating: 5, spinCount: 1, daysSince: 200 });
  });

  it('leans on rating for "favorites" and on dust for "neglected"', async () => {
    const favorite = await add('Favorite, played last week');
    const forgotten = await add('Forgotten, low rated');
    await rate(favorite, 5);
    await rate(forgotten, 2);
    await playedDaysAgo(favorite, 7);
    await playedDaysAgo(forgotten, 300);

    expect(titles({ mood: 'favorites' })[0]).toBe('Favorite, played last week');
    expect(titles({ mood: 'neglected' })[0]).toBe('Forgotten, low rated');
  });

  it('treats a never-played record as fully dusty', async () => {
    await add('Never played');
    const played = await add('Played a month ago');
    await playedDaysAgo(played, 30);

    const result = suggest({ mood: 'neglected' });

    expect(result.suggestions[0]?.record.title).toBe('Never played');
    expect(result.suggestions[0]).toMatchObject({ lastPlayedAt: null, spinCount: 0 });
  });

  it('puts records played in the last two days at the bottom', async () => {
    const yesterday = await add('Played yesterday');
    const other = await add('Played last month');
    await rate(yesterday, 5);
    await rate(other, 1);
    await playedDaysAgo(yesterday, 1);
    await playedDaysAgo(other, 30);

    expect(titles({ mood: 'favorites' })).toEqual(['Played last month', 'Played yesterday']);
  });

  it('filters by genre, ignoring capital letters, and lists the shelf’s genres', async () => {
    await add('Jazz One', { genres: ['Jazz'] });
    await add('Jazz Two', { genres: ['Jazz', 'Funk / Soul'] });
    await add('Rock One', { genres: ['Rock'] });

    const result = suggest({ genre: 'jazz' });

    expect(result.suggestions.map((s) => s.record.title).sort()).toEqual(['Jazz One', 'Jazz Two']);
    expect(result.matchCount).toBe(2);
    // Most common first, then alphabetical; the list isn't narrowed by the filter.
    expect(result.genres).toEqual(['Jazz', 'Funk / Soul', 'Rock']);
  });

  it('only suggests what fits the time, down to the sides to play', async () => {
    const double = await add('Double Album', { runtimeSeconds: null });
    replaceTracks(
      ctx.db,
      double,
      sides(20, 20, 20, 20).map((t, sortOrder) => ({ ...t, sortOrder })),
    );
    await add('Short LP', { runtimeSeconds: 30 * MIN });
    await add('Long LP, no tracklist', { runtimeSeconds: 70 * MIN });

    const result = suggest({ minutes: 45 });

    const byTitle = Object.fromEntries(result.suggestions.map((s) => [s.record.title, s]));
    expect(Object.keys(byTitle).sort()).toEqual(['Double Album', 'Short LP']);
    expect(byTitle['Double Album']).toMatchObject({ sides: ['A', 'B'], durationSeconds: 40 * MIN });
    expect(byTitle['Short LP']).toMatchObject({ sides: null, durationSeconds: 30 * MIN });
    expect(result.matchCount).toBe(2);
  });

  it('gives different records when asked to leave some out (Shuffle)', async () => {
    const ids = [];
    for (const title of ['One', 'Two', 'Three', 'Four', 'Five']) ids.push(await add(title));

    const first = suggest();
    const shown = first.suggestions.map((s) => s.record.id);
    const second = suggest({ exclude: shown.join(',') });

    expect(first.suggestions).toHaveLength(3);
    expect(second.suggestions).toHaveLength(2);
    expect(second.suggestions.some((s) => shown.includes(s.record.id))).toBe(false);
    // matchCount still counts everything that fits, so the website knows when it has shown it all.
    expect(second.matchCount).toBe(5);
  });

  it('avoids two records by the same artist when there are other choices', async () => {
    const a1 = await add('Miles One', { artists: ['Miles Davis'] });
    const a2 = await add('Miles Two', { artists: ['Miles Davis'] });
    const a3 = await add('Miles Three', { artists: ['Miles Davis'] });
    await add('Someone Else', { artists: ['Joni Mitchell'] });
    await add('Another', { artists: ['Nina Simone'] });
    for (const id of [a1, a2, a3]) await rate(id, 5);

    const picks = suggest({ mood: 'favorites' }).suggestions;

    const miles = picks.filter((s) => s.record.artists[0]?.name === 'Miles Davis');
    expect(picks).toHaveLength(3);
    expect(miles).toHaveLength(1);
  });

  it('still fills three from one artist when that is all there is', async () => {
    for (const title of ['A', 'B', 'C']) await add(title, { artists: ['Miles Davis'] });

    expect(suggest().suggestions).toHaveLength(3);
  });

  it('answers through the API, and rejects bad questions', async () => {
    await add('Kind of Blue', { genres: ['Jazz'] });

    const ok = await ctx.api.get('/api/suggestions').query({ minutes: 60, mood: 'neglected' });
    expect(ok.status).toBe(200);
    expect(suggestionsSchema.parse(ok.body).suggestions[0]?.record.title).toBe('Kind of Blue');

    for (const bad of [
      { minutes: 2 },
      { mood: 'party' },
      { exclude: 'abc' },
      { exclude: '1,,2' },
    ]) {
      const res = await ctx.api.get('/api/suggestions').query(bad);
      expect(res.status, JSON.stringify(bad)).toBe(400);
      expect(apiErrorSchema.parse(res.body).error.code).toBe('VALIDATION');
    }
  });

  it('has nothing to suggest for an empty shelf', () => {
    expect(suggest()).toEqual({ suggestions: [], matchCount: 0, genres: [] });
  });
});
