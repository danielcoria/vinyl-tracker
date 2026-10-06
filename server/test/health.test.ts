import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { apiErrorSchema, healthResponseSchema } from '@vinyl/shared';
import { makeTestApp } from './helpers.js';

describe('GET /api/health', () => {
  it('returns ok with a valid body', async () => {
    const res = await request(makeTestApp().app).get('/api/health');

    expect(res.status).toBe(200);
    expect(healthResponseSchema.parse(res.body).status).toBe('ok');
  });
});

describe('unknown API routes', () => {
  it('return 404 in the standard error shape', async () => {
    const res = await request(makeTestApp().app).get('/api/nope');

    expect(res.status).toBe(404);
    const { error } = apiErrorSchema.parse(res.body);
    expect(error.code).toBe('NOT_FOUND');
    expect(error.message).toBe('No route for GET /api/nope');
  });
});
