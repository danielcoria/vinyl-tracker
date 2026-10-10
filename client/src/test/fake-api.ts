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
// website sent. Unless a test overrides them: "GET /api/health" answers "ok",
// tracklists are empty, the diary has no plays, and there are no styluses.
// ============================================================================

import type { Spin, Track, VinylRecord } from '@vinyl/shared';
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
    'GET /api/health': () => json({ status: 'ok', uptimeSeconds: 1, demo: false }),
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
    if (handler) return handler(call);
    // Sensible defaults so tests only list the routes they care about:
    // no tracklist, and no plays in the diary.
    if (method === 'GET' && /^\/api\/records\/\d+\/tracks$/.test(url.pathname)) {
      return json({ tracks: [] });
    }
    if (method === 'GET' && url.pathname === '/api/spins') return json({ spins: [] });
    if (method === 'GET' && url.pathname === '/api/styluses') return json({ styluses: [] });
    return apiError(404, 'NOT_FOUND', `No fake route for ${method} ${url.pathname}`);
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
    spinCount: 0,
    lastPlayedAt: null,
    ...overrides,
  };
}

/** Kind of Blue's real tracklist (sides A and B), as the server sends it. */
export const KIND_OF_BLUE_TRACKS: Track[] = [
  { id: 1, position: 'A1', side: 'A', title: 'So What', durationSeconds: 536 },
  { id: 2, position: 'A2', side: 'A', title: 'Freddie Freeloader', durationSeconds: 572 },
  { id: 3, position: 'A3', side: 'A', title: 'Blue In Green', durationSeconds: 327 },
  { id: 4, position: 'B1', side: 'B', title: 'All Blues', durationSeconds: 694 },
  { id: 5, position: 'B2', side: 'B', title: 'Flamenco Sketches', durationSeconds: 572 },
];

/** A logged play for tests. */
export function makeSpin(overrides: Partial<Spin> = {}): Spin {
  return {
    id: 1,
    playedAt: '2026-10-06T19:00:00.000Z',
    durationSeconds: 1435,
    sides: ['A'],
    notes: null,
    record: {
      id: 1,
      title: 'Kind of Blue',
      artists: [{ id: 1, name: 'Miles Davis' }],
      coverImageUrl: null,
    },
    ...overrides,
  };
}
