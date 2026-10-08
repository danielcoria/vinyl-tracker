// ============================================================================
// client.ts: TALKS TO THE DISCOGS API
//
// Every request to Discogs goes through here. It:
//   - sends your token and our app name (Discogs requires both)
//   - answers from the cache when it can (ttl-cache.ts)
//   - refuses to go over 60 requests a minute (rate-limiter.ts)
//   - checks the answer's shape (schemas.ts)
//   - turns Discogs problems into clear errors for the website
// The token is only ever used in the Authorization header. It is never logged.
// ============================================================================

import { z } from 'zod';
import { AppError } from '../../errors.js';
import { RateLimiter } from './rate-limiter.js';
import { rawReleaseSchema, rawSearchSchema, type RawRelease, type RawSearch } from './schemas.js';
import { TtlCache } from './ttl-cache.js';

const BASE_URL = 'https://api.discogs.com';
const MINUTE = 60 * 1000;
const SEARCH_TTL = 10 * MINUTE;
const RELEASE_TTL = 24 * 60 * MINUTE; // release details rarely change
const TIMEOUT_MS = 10_000;

export class DiscogsError extends AppError {}

export type DiscogsClientOptions = {
  token: string;
  userAgent: string;
  /** Lets tests replace the real network with recorded answers. */
  fetch?: typeof fetch;
  /** Lets tests control the clock for the cache and the rate limit. */
  now?: () => number;
};

export class DiscogsClient {
  private readonly fetch: typeof fetch;
  private readonly limiter: RateLimiter;
  private readonly cache: TtlCache<unknown>;

  constructor(private readonly options: DiscogsClientOptions) {
    this.fetch = options.fetch ?? fetch;
    this.limiter = new RateLimiter(60, MINUTE, options.now);
    this.cache = new TtlCache(500, options.now);
  }

  /** Searches vinyl releases. `page` starts at 1. */
  search(query: string, page: number): Promise<RawSearch> {
    const params = new URLSearchParams({
      q: query,
      type: 'release',
      format: 'Vinyl',
      per_page: '20',
      page: String(page),
    });
    return this.get(`/database/search?${params}`, rawSearchSchema, SEARCH_TTL);
  }

  /** Everything about one release: artists, label, tracklist, images... */
  getRelease(releaseId: number): Promise<RawRelease> {
    return this.get(`/releases/${releaseId}`, rawReleaseSchema, RELEASE_TTL);
  }

  private async get<T>(path: string, schema: z.ZodType<T>, ttlMs: number): Promise<T> {
    // Search text is matched case-insensitively, so cache it that way too.
    const cacheKey = path.toLowerCase();
    const cached = this.cache.get(cacheKey);
    if (cached !== undefined) return cached as T;

    if (!this.limiter.tryAcquire()) throw busyError();

    let res: Response;
    try {
      res = await this.fetch(`${BASE_URL}${path}`, {
        headers: {
          Authorization: `Discogs token=${this.options.token}`,
          'User-Agent': this.options.userAgent,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw unavailableError();
    }

    if (res.status === 404) {
      throw new DiscogsError(404, 'DISCOGS_NOT_FOUND', "That release wasn't found on Discogs");
    }
    if (res.status === 429) throw busyError();
    if (res.status === 401 || res.status === 403) {
      throw new DiscogsError(
        502,
        'DISCOGS_AUTH',
        'Discogs rejected the token. Check DISCOGS_TOKEN in the .env file.',
      );
    }
    if (!res.ok) throw unavailableError();

    const parsed = schema.safeParse(await res.json().catch(() => undefined));
    if (!parsed.success) {
      throw new DiscogsError(
        502,
        'DISCOGS_BAD_RESPONSE',
        'Discogs sent an answer we did not expect',
      );
    }

    this.cache.set(cacheKey, parsed.data, ttlMs);
    return parsed.data;
  }
}

function busyError() {
  return new DiscogsError(
    503,
    'DISCOGS_BUSY',
    'Discogs is getting a lot of requests from this app. Try again in a minute.',
  );
}

function unavailableError() {
  return new DiscogsError(502, 'DISCOGS_UNAVAILABLE', "Couldn't reach Discogs. Try again later.");
}
