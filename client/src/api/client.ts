// ============================================================================
// api/client.ts: THE ONE PLACE THE WEBSITE TALKS TO THE SERVER
//
// Every request from the website to our server goes through these helpers:
//   apiGet    read data        (GET)
//   apiSend   create/replace   (POST / PUT), sending data along
//   apiDelete delete           (DELETE)
// Each one sends the request, turns server errors into a clear ApiRequestError,
// and checks the answer has the shape we expect (using a schema from shared/).
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

/** Sends one request and returns the parsed JSON body (undefined if there is none). */
async function request(path: string, init: RequestInit = {}): Promise<unknown> {
  // `fetch` is the browser's built-in way to make a web request.
  // `await` means "wait for the answer before moving to the next line".
  const res = await fetch(path, {
    ...init,
    headers: { Accept: 'application/json', ...init.headers },
  });
  const body: unknown = res.status === 204 ? undefined : await res.json().catch(() => undefined);

  // res.ok is false for error codes like 400, 404 or 500.
  if (!res.ok) {
    const parsed = apiErrorSchema.safeParse(body);
    const { code, message } = parsed.success
      ? parsed.data.error
      : { code: 'HTTP_ERROR', message: `Request failed with ${res.status}` };
    throw new ApiRequestError(res.status, code, message);
  }
  return body;
}

/** GET data and check it matches `schema`. */
export async function apiGet<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  return schema.parse(await request(path));
}

/** POST or PUT `data` as JSON and check the answer matches `schema`. */
export async function apiSend<T>(
  method: 'POST' | 'PUT',
  path: string,
  data: unknown,
  schema: z.ZodType<T>,
): Promise<T> {
  const body = await request(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return schema.parse(body);
}

/** DELETE something. The server answers 204 (done, nothing to send back). */
export async function apiDelete(path: string): Promise<void> {
  await request(path, { method: 'DELETE' });
}

/** A message for people explaining what went wrong. */
export function describeError(error: Error): string {
  // The server answered with a problem: use its explanation.
  if (error instanceof ApiRequestError) return error.message;
  // `fetch` fails with a TypeError when it can't connect at all.
  if (error instanceof TypeError) {
    return "Couldn't reach the server. Check that it's running (npm run dev).";
  }
  // Anything else (e.g. the answer had an unexpected shape) is a bug on our side.
  return `Something went wrong: ${error.message}`;
}
