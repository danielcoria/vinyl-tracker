// ============================================================================
// client.test.ts: TESTS FOR TALKING TO THE SERVER
// ============================================================================

import { recordSchema } from '@vinyl/shared';
import { describe, expect, it, vi } from 'vitest';
import { apiError, json, mockApi } from '../test/fake-api';
import { ApiRequestError, apiGet, describeError } from './client';

describe('apiGet', () => {
  it("turns the server's error answer into an ApiRequestError", async () => {
    mockApi({ 'GET /api/records/9': () => apiError(404, 'NOT_FOUND', 'Record 9 not found') });

    const error = await apiGet('/api/records/9', recordSchema).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({ status: 404, code: 'NOT_FOUND', message: 'Record 9 not found' });
  });

  it('rejects an answer with the wrong shape', async () => {
    mockApi({ 'GET /api/records/9': () => json({ id: 'nine' }) });

    await expect(apiGet('/api/records/9', recordSchema)).rejects.toThrow();
  });
});

describe('describeError', () => {
  it("uses the server's explanation when there is one", () => {
    expect(describeError(new ApiRequestError(400, 'VALIDATION', 'title: Title is required'))).toBe(
      'title: Title is required',
    );
  });

  it('says when the server cannot be reached', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('Failed to fetch')));
    const error = await apiGet('/api/health', recordSchema).then(
      () => new Error('expected the request to fail'),
      (e: Error) => e,
    );

    expect(describeError(error)).toMatch(/Couldn't reach the server/);
  });

  it("doesn't blame the connection for other problems", () => {
    expect(describeError(new Error('bad shape'))).toBe('Something went wrong: bad shape');
  });
});
