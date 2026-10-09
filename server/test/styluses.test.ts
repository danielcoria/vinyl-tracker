// ============================================================================
// styluses.test.ts: TESTS FOR THE STYLUS WEAR TRACKER
//
// Wear comes from the plays logged while each stylus was installed, so these
// tests log plays at known times and check the hours add up.
// ============================================================================

import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { apiErrorSchema, stylusListSchema, stylusSchema, type StylusInput } from '@vinyl/shared';
import { statusFor } from '../src/services/styluses.js';
import { makeTestApp, recordInput } from './helpers.js';

let ctx: ReturnType<typeof makeTestApp>;
let recordId: number;

beforeEach(async () => {
  ctx = makeTestApp();
  recordId = (await request(ctx.app).post('/api/records').send(recordInput())).body.id;
});

async function install(input: Partial<StylusInput> = {}) {
  return request(ctx.app)
    .post('/api/styluses')
    .send({ name: 'AT-VM95E', ratedHours: 500, ...input });
}

async function play(playedAt: string, hours: number) {
  const res = await request(ctx.app)
    .post('/api/spins')
    .send({ recordId, playedAt, durationSeconds: hours * 3600 });
  expect(res.status).toBe(201);
}

async function list() {
  return stylusListSchema.parse((await request(ctx.app).get('/api/styluses')).body).styluses;
}

describe('stylus wear', () => {
  it('adds up the plays logged while the stylus is installed', async () => {
    await install({ installedAt: '2026-01-01T00:00:00.000Z', initialHours: 10 });
    await play('2025-12-31T20:00:00.000Z', 5); // before it was installed: doesn't count
    await play('2026-03-01T20:00:00.000Z', 2);
    await play('2026-06-01T20:00:00.000Z', 1.5);

    const [stylus] = await list();

    expect(stylus).toMatchObject({
      hoursUsed: 13.5, // 10 starting + 2 + 1.5
      spinCount: 2,
      percentUsed: 3, // 13.5 of 500
      status: 'ok',
      averageSpinSeconds: 6300, // 1.75 hours
      retiredAt: null,
    });
  });

  it('splits plays between the old and new stylus at the moment of the swap', async () => {
    await install({ name: 'Old', installedAt: '2026-01-01T00:00:00.000Z' });
    await play('2026-02-01T20:00:00.000Z', 3);
    const added = await install({ name: 'New', installedAt: '2026-05-01T00:00:00.000Z' });
    await play('2026-06-01T20:00:00.000Z', 1);
    // Logged later, but dated while the old stylus was in use.
    await play('2026-04-15T20:00:00.000Z', 2);

    expect(added.status).toBe(201);
    const [newer, older] = await list();
    expect(newer).toMatchObject({ name: 'New', hoursUsed: 1, retiredAt: null });
    expect(older).toMatchObject({
      name: 'Old',
      hoursUsed: 5,
      retiredAt: '2026-05-01T00:00:00.000Z',
    });
  });

  it('warns at 75% and says replace at 100%', () => {
    expect(statusFor(0.5)).toBe('ok');
    expect(statusFor(0.75)).toBe('soon');
    expect(statusFor(0.99)).toBe('soon');
    expect(statusFor(1)).toBe('replace');
    expect(statusFor(1.4)).toBe('replace');
  });

  it('shows a used stylus at its starting hours', async () => {
    const res = await install({ ratedHours: 400, initialHours: 380 });

    expect(stylusSchema.parse(res.body)).toMatchObject({ percentUsed: 95, status: 'soon' });
  });
});

describe('installing and editing', () => {
  it("won't install a stylus dated before the current one", async () => {
    await install({ installedAt: '2026-05-01T00:00:00.000Z' });

    const res = await install({ installedAt: '2026-04-01T00:00:00.000Z' });

    expect(res.status).toBe(400);
    expect(apiErrorSchema.parse(res.body).error.code).toBe('INSTALLED_BEFORE_CURRENT');
    expect(await list()).toHaveLength(1);
  });

  it('rejects bad input with clear messages', async () => {
    const res = await install({ name: '', ratedHours: 5 });

    expect(res.status).toBe(400);
    const { message } = apiErrorSchema.parse(res.body).error;
    expect(message).toContain('name: Give the stylus a name');
    expect(message).toContain('ratedHours: Rated hours must be at least 50');
  });

  it('edits the name, rating and starting hours', async () => {
    const { body } = await install();

    const res = await request(ctx.app)
      .put(`/api/styluses/${body.id}`)
      .send({ name: 'Shibata', ratedHours: 1000, initialHours: 250 });

    expect(stylusSchema.parse(res.body)).toMatchObject({
      name: 'Shibata',
      ratedHours: 1000,
      initialHours: 250,
      percentUsed: 25,
    });
  });
});

describe('deleting', () => {
  it('deleting the stylus in use puts the previous one back in use', async () => {
    await install({ name: 'Old', installedAt: '2026-01-01T00:00:00.000Z' });
    const mistake = await install({ name: 'Mistake', installedAt: '2026-05-01T00:00:00.000Z' });

    const res = await request(ctx.app).delete(`/api/styluses/${mistake.body.id}`);

    expect(res.status).toBe(204);
    const all = await list();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ name: 'Old', retiredAt: null });
  });

  it('deleting an old stylus leaves the one in use alone', async () => {
    const old = await install({ name: 'Old', installedAt: '2026-01-01T00:00:00.000Z' });
    await install({ name: 'Current', installedAt: '2026-05-01T00:00:00.000Z' });

    await request(ctx.app).delete(`/api/styluses/${old.body.id}`);

    expect((await list()).map((s) => [s.name, s.retiredAt])).toEqual([['Current', null]]);
  });

  it('returns 404 for a stylus that does not exist', async () => {
    expect((await request(ctx.app).delete('/api/styluses/99')).status).toBe(404);
  });
});
