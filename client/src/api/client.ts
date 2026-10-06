// ============================================================================
// api/client.ts: THE ONE PLACE THE WEBSITE TALKS TO THE SERVER
//
// Every request from the website to our server goes through `apiGet` (more
// helpers like apiPost come in M3). It does three things:
//   1. sends the request
//   2. if the server says something went wrong, turns that into a clear error
//   3. checks the answer has the shape we expect (using a "schema" from shared/)
// ============================================================================

import { apiErrorSchema } from '@vinyl/shared';
import type { z } from 'zod';

/** The error thrown when the server answers with a problem (e.g. 404 Not Found). */
export class ApiRequestError extends Error {
  constructor(
    readonly status: number, // HTTP status code, e.g. 404
    readonly code: string, // our short error name, e.g. 'NOT_FOUND'
    message: string, // a human-readable explanation
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

/**
 * GET some data from our server.
 * `path` is the address (like '/api/health'), and `schema` describes the shape
 * the answer must have. If the answer doesn't match, we fail loudly instead of
 * letting bad data quietly break the page later.
 */
export async function apiGet<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  // `fetch` is the browser's built-in way to make a web request.
  // `await` means "wait for the answer before moving to the next line".
  const res = await fetch(path, { headers: { Accept: 'application/json' } });
  const body: unknown = await res.json().catch(() => undefined);

  // res.ok is false for error codes like 404 or 500.
  if (!res.ok) {
    const parsed = apiErrorSchema.safeParse(body);
    const { code, message } = parsed.success
      ? parsed.data.error
      : { code: 'HTTP_ERROR', message: `Request failed with ${res.status}` };
    throw new ApiRequestError(res.status, code, message);
  }

  // Check the shape and return the data.
  return schema.parse(body);
}
