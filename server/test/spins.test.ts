// ============================================================================
// spins.test.ts: TESTS FOR THE LISTENING DIARY
//
// Logging plays (whole record or chosen sides), the diary list, deleting,
// and the play counts shown on records.
// ============================================================================

import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { apiErrorSchema, recordSchema, spinListSchema, spinSchema } from '@vinyl/shared';
import { spinTracks } from '../src/db/schema.js';
import { replaceTracks } from '../src/services/tracks.js';
import { makeTestApp, recordInput } from './helpers.js';

let ctx: ReturnType<typeof makeTestApp>;
let recordId: number;

/** A double album: sides A-D, two 10-minute tracks each. */
const DOUBLE_ALBUM = ['A', 'B', 'C', 'D'].flatMap((side, s) =>
  [1, 2].map((n, t) => ({
    position: `${side}${n}`,
    side,
    title: `Song ${side}${n}`,
    durationSeconds: 600,
    sortOrder: s * 2 + t,
  })),
);

beforeEach(async () => {
  ctx = makeTestApp();
  const res = await request(ctx.app)
    .post('/api/records')
    .send(recordInput({ title: 'Double' }));
  recordId = res.body.id;
  replaceTracks(ctx.db, recordId, DOUBLE_ALBUM);
});

function logSpin(body: Record<string, unknown>) {
  return request(ctx.app)
    .post('/api/spins')
    .send({ recordId, durationSeconds: 1200, ...body });
}

const errorOf = (body: unknown) => apiErrorSchema.parse(body).error;
const tracksOfSpin = (spinId: number) =>
  ctx.db
    .select()
    .from(spinTracks)
    .all()
    .filter((row) => row.spinId === spinId).length;

describe('POST /api/spins', () => {
  it('logs chosen sides, in record order, with the tracks they cover', async () => {
    const res = await logSpin({ sides: ['c', 'A'], playedAt: '2026-10-01T20:00:00.000Z' });

    expect(res.status).toBe(201);
    const spin = spinSchema.parse(res.body);
    expect(spin).toMatchObject({
      sides: ['A', 'C'],
      playedAt: '2026-10-01T20:00:00.000Z',
      durationSeconds: 1200,
      record: { id: recordId, title: 'Double' },
    });
    expect(tracksOfSpin(spin.id)).toBe(4);
  });

  it('treats "every side" as the whole record', async () => {
    const res = await logSpin({ sides: ['A', 'B', 'C', 'D'], durationSeconds: 4800 });

    const spin = spinSchema.parse(res.body);
    expect(spin.sides).toBeNull();
    expect(tracksOfSpin(spin.id)).toBe(8);
  });

  it('logs the whole record when no sides are given, starting now', async () => {
    const before = Date.now();
    const res = await logSpin({ durationSeconds: 4800 });

    const spin = spinSchema.parse(res.body);
    expect(spin.sides).toBeNull();
    expect(Date.parse(spin.playedAt)).toBeGreaterThanOrEqual(before - 1000);
  });

  it('works for records without a tracklist (whole record only)', async () => {
    const plain = await request(ctx.app).post('/api/records').send(recordInput());

    const whole = await request(ctx.app)
      .post('/api/spins')
      .send({ recordId: plain.body.id, durationSeconds: 2744 });
    expect(whole.status).toBe(201);

    const sideA = await request(ctx.app)
      .post('/api/spins')
      .send({ recordId: plain.body.id, durationSeconds: 1200, sides: ['A'] });
    expect(sideA.status).toBe(400);
    expect(errorOf(sideA.body).code).toBe('NO_SIDES');
  });

  it("rejects a side that isn't on the record", async () => {
    const res = await logSpin({ sides: ['E'] });

    expect(res.status).toBe(400);
    expect(errorOf(res.body)).toEqual({
      code: 'UNKNOWN_SIDE',
      message: "Side E isn't on this record",
    });
  });

  it('rejects plays in the future, zero length, and missing records', async () => {
    const future = await logSpin({ playedAt: new Date(Date.now() + 3600_000).toISOString() });
    expect(errorOf(future.body).message).toBe("playedAt: The play can't start in the future");

    const zero = await logSpin({ durationSeconds: 0 });
    expect(errorOf(zero.body).message).toBe('durationSeconds: Length must be more than zero');

    const missing = await request(ctx.app)
      .post('/api/spins')
      .send({ recordId: 999, durationSeconds: 60 });
    expect(missing.status).toBe(404);
  });
});

describe('GET /api/spins', () => {
  it('lists the diary newest first, with each record', async () => {
    await logSpin({ sides: ['A'], playedAt: '2026-10-01T20:00:00.000Z' });
    await logSpin({ sides: ['B'], playedAt: '2026-10-03T20:00:00.000Z' });
    await logSpin({ sides: ['C'], playedAt: '2026-10-02T20:00:00.000Z' });

    const res = await request(ctx.app).get('/api/spins');

    const { spins } = spinListSchema.parse(res.body);
    expect(spins.map((s) => s.sides)).toEqual([['B'], ['C'], ['A']]);
    expect(spins[0]?.record.artists.map((a) => a.name)).toEqual(['Miles Davis']);
  });

  it('filters by record and limits the count', async () => {
    const other = await request(ctx.app)
      .post('/api/records')
      .send(recordInput({ title: 'Other' }));
    await logSpin({});
    await logSpin({});
    await request(ctx.app)
      .post('/api/spins')
      .send({ recordId: other.body.id, durationSeconds: 60 });

    const forRecord = await request(ctx.app).get('/api/spins').query({ recordId });
    expect(spinListSchema.parse(forRecord.body).spins).toHaveLength(2);

    const limited = await request(ctx.app).get('/api/spins').query({ limit: 1 });
    expect(spinListSchema.parse(limited.body).spins).toHaveLength(1);
  });
});

describe('DELETE /api/spins/:id', () => {
  it('removes the play', async () => {
    const spin = await logSpin({});

    expect((await request(ctx.app).delete(`/api/spins/${spin.body.id}`)).status).toBe(204);
    expect((await request(ctx.app).delete(`/api/spins/${spin.body.id}`)).status).toBe(404);
    expect(spinListSchema.parse((await request(ctx.app).get('/api/spins')).body).spins).toEqual([]);
  });
});

describe('play counts on records', () => {
  it('shows how often and when a record was last played', async () => {
    const fresh = recordSchema.parse((await request(ctx.app).get(`/api/records/${recordId}`)).body);
    expect(fresh).toMatchObject({ spinCount: 0, lastPlayedAt: null });

    await logSpin({ playedAt: '2026-10-01T20:00:00.000Z' });
    await logSpin({ playedAt: '2026-10-05T21:30:00.000Z' });

    const played = recordSchema.parse(
      (await request(ctx.app).get(`/api/records/${recordId}`)).body,
    );
    expect(played).toMatchObject({ spinCount: 2, lastPlayedAt: '2026-10-05T21:30:00.000Z' });
  });

  it('deleting a record deletes its plays', async () => {
    await logSpin({});

    await request(ctx.app).delete(`/api/records/${recordId}`);

    expect(spinListSchema.parse((await request(ctx.app).get('/api/spins')).body).spins).toEqual([]);
  });
});

describe('GET /api/records/:id/tracks', () => {
  it('returns the tracklist in order, with sides', async () => {
    const res = await request(ctx.app).get(`/api/records/${recordId}/tracks`);

    expect(res.status).toBe(200);
    expect(res.body.tracks.map((t: { position: string }) => t.position)).toEqual(
      DOUBLE_ALBUM.map((t) => t.position),
    );
    expect(res.body.tracks[0]).toMatchObject({ side: 'A', title: 'Song A1', durationSeconds: 600 });
  });

  it('keeps a tracklist that logged plays depend on', async () => {
    await logSpin({ sides: ['A'] });

    const replaced = replaceTracks(ctx.db, recordId, []);

    expect(replaced).toBe(false);
    const res = await request(ctx.app).get(`/api/records/${recordId}/tracks`);
    expect(res.body.tracks).toHaveLength(8);
  });
});
