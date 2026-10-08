// ============================================================================
// records.test.ts: TESTS: EVERYTHING YOU CAN DO WITH RECORDS
//
// Adds, lists, searches, sorts, edits and deletes records through the real
// API (on a temporary database) and checks every answer, including the
// error cases (bad input, missing records, broken JSON).
// ============================================================================

import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { apiErrorSchema, recordListSchema, recordSchema, type RecordInput } from '@vinyl/shared';
import { artists } from '../src/db/schema.js';
import { makeTestApp, recordInput } from './helpers.js';

let ctx: ReturnType<typeof makeTestApp>;
beforeEach(() => {
  ctx = makeTestApp();
});

async function create(overrides: Partial<RecordInput> = {}) {
  const res = await request(ctx.app).post('/api/records').send(recordInput(overrides));
  expect(res.status).toBe(201);
  return recordSchema.parse(res.body);
}

async function list(query: Record<string, string> = {}) {
  const res = await request(ctx.app).get('/api/records').query(query);
  expect(res.status).toBe(200);
  return recordListSchema.parse(res.body).records;
}

function errorOf(body: unknown) {
  return apiErrorSchema.parse(body).error;
}

function artistNames() {
  return ctx.db
    .select()
    .from(artists)
    .all()
    .map((a) => a.name);
}

describe('POST /api/records', () => {
  it('creates a record with artists, genres and styles', async () => {
    const res = await request(ctx.app)
      .post('/api/records')
      .send(
        recordInput({
          title: 'The Velvet Underground & Nico',
          artists: ['The Velvet Underground', 'Nico'],
          genres: ['Rock'],
          styles: ['Garage Rock', 'Art Rock'],
          mediaCondition: 'VG+',
        }),
      );

    expect(res.status).toBe(201);
    const record = recordSchema.parse(res.body);
    expect(res.headers.location).toBe(`/api/records/${record.id}`);
    expect(record).toMatchObject({
      title: 'The Velvet Underground & Nico',
      discogsReleaseId: null,
      mediaCondition: 'VG+',
      sleeveCondition: null,
      genres: ['Rock'],
      styles: ['Art Rock', 'Garage Rock'],
    });
    expect(record.artists.map((a) => a.name)).toEqual(['The Velvet Underground', 'Nico']);
    expect(record.addedAt).toBe(record.updatedAt);
  });

  it('trims input and turns blank optional text into null', async () => {
    const record = await create({ title: '  Blue  ', label: '', notes: '   ', coverImageUrl: '' });

    expect(record.title).toBe('Blue');
    expect(record.label).toBeNull();
    expect(record.notes).toBeNull();
    expect(record.coverImageUrl).toBeNull();
  });

  it('removes case-insensitive duplicate tags', async () => {
    const record = await create({ genres: ['Jazz', 'jazz', 'JAZZ'] });
    expect(record.genres).toEqual(['Jazz']);
  });

  it('reuses an existing artist regardless of case', async () => {
    const first = await create({ artists: ['Miles Davis'] });
    const second = await create({ title: 'Bitches Brew', artists: ['miles davis'] });

    expect(second.artists[0]?.id).toBe(first.artists[0]?.id);
    expect(second.artists[0]?.name).toBe('Miles Davis');
  });

  it('rejects invalid input with field-level messages', async () => {
    const res = await request(ctx.app)
      .post('/api/records')
      .send({ title: '', artists: [], year: 1800, mediaCondition: 'Mint-ish' });

    expect(res.status).toBe(400);
    const error = errorOf(res.body);
    expect(error.code).toBe('VALIDATION');
    expect(error.message).toContain('title: Title is required');
    expect(error.message).toContain('artists: At least one artist is required');
    expect(error.message).toContain('year: Year must be 1900 or later');
    expect(error.message).toContain('mediaCondition:');
  });

  it('accepts http(s) cover addresses and rejects anything else', async () => {
    const ok = await create({ coverImageUrl: 'https://example.com/cover.jpg' });
    expect(ok.coverImageUrl).toBe('https://example.com/cover.jpg');

    for (const coverImageUrl of ['not a url', 'javascript:alert(1)', 'ftp://example.com/a.jpg']) {
      const res = await request(ctx.app).post('/api/records').send(recordInput({ coverImageUrl }));
      expect(res.status).toBe(400);
      expect(errorOf(res.body).message).toBe(
        'coverImageUrl: Enter a full web address, starting with https://',
      );
    }
  });

  it('rejects a malformed JSON body', async () => {
    const res = await request(ctx.app)
      .post('/api/records')
      .set('Content-Type', 'application/json')
      .send('{"title": ');

    expect(res.status).toBe(400);
    expect(errorOf(res.body).code).toBe('INVALID_JSON');
  });

  it('ignores a client-supplied discogsReleaseId', async () => {
    const res = await request(ctx.app)
      .post('/api/records')
      .send({ ...recordInput(), discogsReleaseId: 12345 });

    expect(recordSchema.parse(res.body).discogsReleaseId).toBeNull();
  });
});

describe('GET /api/records/:id', () => {
  it('returns the record', async () => {
    const created = await create();
    const res = await request(ctx.app).get(`/api/records/${created.id}`);

    expect(res.status).toBe(200);
    expect(recordSchema.parse(res.body)).toEqual(created);
  });

  it('returns 404 for a missing record', async () => {
    const res = await request(ctx.app).get('/api/records/999');

    expect(res.status).toBe(404);
    expect(errorOf(res.body)).toEqual({ code: 'NOT_FOUND', message: 'Record 999 not found' });
  });

  it('returns 400 for a non-numeric id', async () => {
    const res = await request(ctx.app).get('/api/records/abc');
    expect(res.status).toBe(400);
  });
});

describe('GET /api/records', () => {
  beforeEach(async () => {
    await create({ title: 'Kind of Blue', artists: ['Miles Davis'], year: 1959 });
    await create({ title: 'Rumours', artists: ['Fleetwood Mac'], year: 1977 });
    await create({ title: 'A Love Supreme', artists: ['John Coltrane'], year: null });
    await create({ title: '100% Pure', artists: ['Somebody'], year: 2001 });
  });

  const titles = (records: { title: string }[]) => records.map((r) => r.title);

  it('defaults to most recently added first', async () => {
    expect(titles(await list())).toEqual([
      '100% Pure',
      'A Love Supreme',
      'Rumours',
      'Kind of Blue',
    ]);
  });

  it('sorts by primary artist', async () => {
    expect(titles(await list({ sort: 'artist' }))).toEqual([
      'Rumours', // Fleetwood Mac
      'A Love Supreme', // John Coltrane
      'Kind of Blue', // Miles Davis
      '100% Pure', // Somebody
    ]);
  });

  it('sorts by title, ignoring case', async () => {
    expect(titles(await list({ sort: 'title' }))).toEqual([
      '100% Pure',
      'A Love Supreme',
      'Kind of Blue',
      'Rumours',
    ]);
  });

  it('sorts by year with unknown years last', async () => {
    expect(titles(await list({ sort: 'year' }))).toEqual([
      'Kind of Blue',
      'Rumours',
      '100% Pure',
      'A Love Supreme',
    ]);
  });

  it('searches title and artist case-insensitively', async () => {
    expect(titles(await list({ q: 'BLUE' }))).toEqual(['Kind of Blue']);
    expect(titles(await list({ q: 'coltrane' }))).toEqual(['A Love Supreme']);
  });

  it('treats LIKE wildcards in the search as literal characters', async () => {
    expect(titles(await list({ q: '%' }))).toEqual(['100% Pure']);
    expect(titles(await list({ q: '_' }))).toEqual([]);
    expect(titles(await list({ q: '!' }))).toEqual([]);
  });

  it('rejects an unknown sort', async () => {
    const res = await request(ctx.app).get('/api/records').query({ sort: 'price' });
    expect(res.status).toBe(400);
  });
});

describe('PUT /api/records/:id', () => {
  it('replaces fields, artists and tags and bumps updatedAt', async () => {
    const created = await create({ artists: ['Miles Davis'], genres: ['Jazz'] });

    const res = await request(ctx.app)
      .put(`/api/records/${created.id}`)
      .send(
        recordInput({
          title: 'Kind of Blue (Reissue)',
          artists: ['Miles Davis', 'John Coltrane'],
          genres: ['Jazz', 'Blues'],
          styles: [],
          sleeveCondition: 'NM',
        }),
      );

    expect(res.status).toBe(200);
    const updated = recordSchema.parse(res.body);
    expect(updated.title).toBe('Kind of Blue (Reissue)');
    expect(updated.artists.map((a) => a.name)).toEqual(['Miles Davis', 'John Coltrane']);
    expect(updated.genres).toEqual(['Blues', 'Jazz']);
    expect(updated.styles).toEqual([]);
    expect(updated.sleeveCondition).toBe('NM');
    expect(updated.addedAt).toBe(created.addedAt);
    expect(updated.updatedAt >= created.updatedAt).toBe(true);
  });

  it('removes artists that no longer have any records', async () => {
    const created = await create({ artists: ['Typo Artsit'] });
    await request(ctx.app)
      .put(`/api/records/${created.id}`)
      .send(recordInput({ artists: ['Typo Artist'] }));

    expect(artistNames()).toEqual(['Typo Artist']);
  });

  it('returns 404 for a missing record', async () => {
    const res = await request(ctx.app).put('/api/records/999').send(recordInput());
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/records/:id', () => {
  it('deletes the record and its orphaned artists', async () => {
    const keep = await create({ title: 'Kind of Blue', artists: ['Miles Davis'] });
    const remove = await create({ title: 'Rumours', artists: ['Fleetwood Mac'] });

    const res = await request(ctx.app).delete(`/api/records/${remove.id}`);

    expect(res.status).toBe(204);
    expect((await request(ctx.app).get(`/api/records/${remove.id}`)).status).toBe(404);
    expect((await list()).map((r) => r.id)).toEqual([keep.id]);
    expect(artistNames()).toEqual(['Miles Davis']);
  });

  it('returns 404 for a missing record', async () => {
    const res = await request(ctx.app).delete('/api/records/999');
    expect(res.status).toBe(404);
  });
});
