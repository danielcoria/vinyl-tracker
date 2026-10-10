// ============================================================================
// discogs-routes.test.ts: TESTS FOR SEARCH, IMPORT AND LINK
//
// Runs the real server (temporary database) with the pretend Discogs.
// ============================================================================

import { describe, expect, it } from 'vitest';
import { apiErrorSchema, discogsSearchResponseSchema, recordSchema } from '@vinyl/shared';
import { fakeDiscogs, KIND_OF_BLUE_RELEASE_ID } from './discogs-helpers.js';
import { makeTestApp, recordInput } from './helpers.js';

function setup() {
  const discogs = fakeDiscogs();
  return { ...makeTestApp({ discogs: discogs.client }), requests: discogs.requests };
}

const errorCode = (body: unknown) => apiErrorSchema.parse(body).error.code;

describe('without a Discogs token', () => {
  it('explains how to set it up', async () => {
    const { api } = makeTestApp();

    const res = await api.get('/api/discogs/search').query({ q: 'blue' });

    expect(res.status).toBe(503);
    expect(apiErrorSchema.parse(res.body).error).toEqual({
      code: 'DISCOGS_NOT_CONFIGURED',
      message: 'Discogs is not set up. Add DISCOGS_TOKEN to the .env file and restart the server.',
    });
  });
});

describe('GET /api/discogs/search', () => {
  it('returns simplified results', async () => {
    const { api } = setup();

    const res = await api.get('/api/discogs/search').query({ q: 'kind of blue' });

    expect(res.status).toBe(200);
    const body = discogsSearchResponseSchema.parse(res.body);
    expect(body.page).toBe(1);
    expect(body.results[0]).toMatchObject({
      releaseId: KIND_OF_BLUE_RELEASE_ID,
      artist: 'Miles Davis',
      title: 'Kind Of Blue',
      inCollectionId: null,
    });
  });

  it('marks releases that are already in the collection', async () => {
    const { api } = setup();
    const imported = await api
      .post('/api/discogs/import')
      .send({ releaseId: KIND_OF_BLUE_RELEASE_ID });

    const res = await api.get('/api/discogs/search').query({ q: 'kind of blue' });

    const result = discogsSearchResponseSchema
      .parse(res.body)
      .results.find((r) => r.releaseId === KIND_OF_BLUE_RELEASE_ID);
    expect(result?.inCollectionId).toBe(imported.body.id);
  });

  it('needs something to search for', async () => {
    const { api, requests } = setup();

    const res = await api.get('/api/discogs/search').query({ q: '   ' });

    expect(res.status).toBe(400);
    expect(apiErrorSchema.parse(res.body).error.message).toBe('q: Type something to search for');
    expect(requests).toHaveLength(0);
  });
});

describe('POST /api/discogs/import', () => {
  it('adds the release to the collection with its cover and details', async () => {
    const { api } = setup();

    const res = await api.post('/api/discogs/import').send({ releaseId: KIND_OF_BLUE_RELEASE_ID });

    expect(res.status).toBe(201);
    const record = recordSchema.parse(res.body);
    expect(res.headers.location).toBe(`/api/records/${record.id}`);
    expect(record).toMatchObject({
      discogsReleaseId: KIND_OF_BLUE_RELEASE_ID,
      title: 'Kind Of Blue',
      year: 2010,
      label: 'Columbia',
      catalogNumber: 'CS 8163',
      format: 'LP',
      runtimeSeconds: 2701,
      genres: ['Jazz'],
      styles: ['Modal'],
    });
    expect(record.artists.map((a) => a.name)).toEqual(['Miles Davis']);
    expect(record.coverImageUrl).toMatch(/^https:\/\/i\.discogs\.com\//);
  });

  it("won't import the same release twice", async () => {
    const { api } = setup();
    await api.post('/api/discogs/import').send({ releaseId: KIND_OF_BLUE_RELEASE_ID });

    const res = await api.post('/api/discogs/import').send({ releaseId: KIND_OF_BLUE_RELEASE_ID });

    expect(res.status).toBe(409);
    expect(errorCode(res.body)).toBe('ALREADY_IN_COLLECTION');
  });

  it('reports releases Discogs does not have', async () => {
    const { api } = setup();

    const res = await api.post('/api/discogs/import').send({ releaseId: 999 });

    expect(res.status).toBe(404);
    expect(errorCode(res.body)).toBe('DISCOGS_NOT_FOUND');
  });
});

describe('POST /api/discogs/link', () => {
  it('fills in the cover and empty details without overwriting yours', async () => {
    const { api } = setup();
    const mine = await api.post('/api/records').send(
      recordInput({
        title: 'Kind of Blue',
        year: 1959,
        label: null,
        runtimeSeconds: null,
        coverImageUrl: null,
        mediaCondition: 'VG',
        notes: 'From my dad.',
        genres: [],
        styles: [],
      }),
    );

    const res = await api
      .post('/api/discogs/link')
      .send({ recordId: mine.body.id, releaseId: KIND_OF_BLUE_RELEASE_ID });

    expect(res.status).toBe(200);
    expect(recordSchema.parse(res.body)).toMatchObject({
      discogsReleaseId: KIND_OF_BLUE_RELEASE_ID,
      // Kept from the record:
      title: 'Kind of Blue',
      year: 1959,
      mediaCondition: 'VG',
      notes: 'From my dad.',
      // Filled in from Discogs because they were empty:
      label: 'Columbia',
      runtimeSeconds: 2701,
      genres: ['Jazz'],
      styles: ['Modal'],
      coverImageUrl: expect.stringMatching(/^https:\/\/i\.discogs\.com\//),
    });
  });

  it("won't link a release that another record already uses", async () => {
    const { api } = setup();
    await api.post('/api/discogs/import').send({ releaseId: KIND_OF_BLUE_RELEASE_ID });
    const other = await api.post('/api/records').send(recordInput());

    const res = await api
      .post('/api/discogs/link')
      .send({ recordId: other.body.id, releaseId: KIND_OF_BLUE_RELEASE_ID });

    expect(res.status).toBe(409);
  });

  it('returns 404 for a record that does not exist', async () => {
    const { api } = setup();

    const res = await api
      .post('/api/discogs/link')
      .send({ recordId: 999, releaseId: KIND_OF_BLUE_RELEASE_ID });

    expect(res.status).toBe(404);
    expect(errorCode(res.body)).toBe('NOT_FOUND');
  });
});

describe('tracklists from Discogs', () => {
  it('saves the tracklist when importing', async () => {
    const { api } = setup();
    const imported = await api
      .post('/api/discogs/import')
      .send({ releaseId: KIND_OF_BLUE_RELEASE_ID });

    const res = await api.get(`/api/records/${imported.body.id}/tracks`);

    expect(res.body.tracks.map((t: { position: string; side: string }) => t.side)).toEqual([
      'A',
      'A',
      'A',
      'B',
      'B',
    ]);
  });

  it('saves the tracklist when linking an existing record', async () => {
    const { api } = setup();
    const mine = await api.post('/api/records').send(recordInput());

    await api
      .post('/api/discogs/link')
      .send({ recordId: mine.body.id, releaseId: KIND_OF_BLUE_RELEASE_ID });

    const res = await api.get(`/api/records/${mine.body.id}/tracks`);
    expect(res.body.tracks).toHaveLength(5);
  });
});
