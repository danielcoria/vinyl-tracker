import { apiErrorSchema } from '@vinyl/shared';
import type { z } from 'zod';

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

/** Fetches from our API and validates the response against a shared schema. */
export async function apiGet<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  const res = await fetch(path, { headers: { Accept: 'application/json' } });
  const body: unknown = await res.json().catch(() => undefined);

  if (!res.ok) {
    const parsed = apiErrorSchema.safeParse(body);
    const { code, message } = parsed.success
      ? parsed.data.error
      : { code: 'HTTP_ERROR', message: `Request failed with ${res.status}` };
    throw new ApiRequestError(res.status, code, message);
  }

  return schema.parse(body);
}
