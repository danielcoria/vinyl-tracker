// ============================================================================
// fake-api.ts: A PRETEND SERVER FOR WEBSITE TESTS
//
// Website tests don't start the real server. Instead, mockApi() replaces the
// browser's `fetch` with a fake that answers from a list of routes you give it:
//
//   const api = mockApi({
//     'GET /api/records': () => json({ records: [makeRecord()] }),
//   });
//
// Every request is also written to `api.calls`, so tests can check what the
// website sent. "GET /api/health" answers "ok" unless a test overrides it.
// ============================================================================

import type { VinylRecord } from '@vinyl/shared';
import { vi } from 'vitest';

type Call = { method: string; path: string; search: URLSearchParams; body: unknown };
type Handler = (call: Call) => Response | Promise<Response>;

export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

export function apiError(status: number, code: string, message: string): Response {
  return json({ error: { code, message } }, status);
}

export function mockApi(routes: Record<string, Handler>) {
  const allRoutes: Record<string, Handler> = {
    'GET /api/health': () => json({ status: 'ok', uptimeSeconds: 1 }),
    ...routes,
  };
  const calls: Call[] = [];

  vi.stubGlobal('fetch', async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = new URL(String(input), 'http://localhost');
    const method = init.method ?? 'GET';
    const body: unknown = typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
    const call = { method, path: url.pathname, search: url.searchParams, body };
    calls.push(call);

    const handler = allRoutes[`${method} ${url.pathname}`];
    if (!handler) return apiError(404, 'NOT_FOUND', `No fake route for ${method} ${url.pathname}`);
    return handler(call);
  });

  return { calls };
}

/** A complete, valid record for tests. Override any field you care about. */
export function makeRecord(overrides: Partial<VinylRecord> = {}): VinylRecord {
  return {
    id: 1,
    discogsReleaseId: null,
    title: 'Kind of Blue',
    artists: [{ id: 1, name: 'Miles Davis' }],
    year: 1959,
    label: 'Columbia',
    catalogNumber: 'CL 1355',
    format: 'LP',
    coverImageUrl: null,
    runtimeSeconds: 2744,
    mediaCondition: 'VG+',
    sleeveCondition: 'VG',
    notes: null,
    genres: ['Jazz'],
    styles: ['Modal'],
    addedAt: '2026-10-01T12:00:00.000Z',
    updatedAt: '2026-10-01T12:00:00.000Z',
    ...overrides,
  };
}
