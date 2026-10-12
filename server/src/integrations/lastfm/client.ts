// ============================================================================
// lastfm/client.ts: TALKS TO LAST.FM
//
// Last.fm keeps a history of what someone streamed. This asks it one thing:
// "which albums did this user play most?" (their public top albums; only the
// username is needed, no Last.fm password).
//
// Like the Discogs client: answers are remembered for a while (so reloading
// the page doesn't ask again), the API key stays on the server, and problems
// become clear errors. Tests replace the network with saved answers.
//
// `LastfmSource` is the small shape the rest of the server depends on. The
// public demo uses a stand-in with built-in sample data (see sample.ts).
// ============================================================================

import { z } from 'zod';
import type { StreamingPeriod } from '@vinyl/shared';
import { AppError } from '../../errors.js';
import { TtlCache } from '../discogs/ttl-cache.js';

const DEFAULT_API_URL = 'https://ws.audioscrobbler.com/2.0/';
const TOP_ALBUMS_TTL = 60 * 60 * 1000; // an hour: top albums change slowly
const TIMEOUT_MS = 10_000;
const LIMIT = 50;

export class LastfmError extends AppError {}

export type TopAlbum = {
  rank: number;
  title: string;
  artist: string;
  playCount: number;
  coverImageUrl: string | null;
  url: string | null;
};

export type LastfmSource = {
  /** True when this username's albums are built-in samples rather than a real account's. */
  isSample(username: string): boolean;
  getTopAlbums(username: string, period: StreamingPeriod): Promise<TopAlbum[]>;
};

// Only the parts of Last.fm's answer that are used. Numbers arrive as text.
const rawTopAlbumsSchema = z.object({
  topalbums: z.object({
    album: z.array(
      z.object({
        name: z.string(),
        playcount: z.coerce.number().int(),
        url: z.string().optional(),
        artist: z.object({ name: z.string() }),
        image: z.array(z.object({ '#text': z.string(), size: z.string() })).default([]),
        '@attr': z.object({ rank: z.coerce.number().int() }).optional(),
      }),
    ),
  }),
});

export type LastfmClientOptions = {
  apiKey: string;
  /** Where Last.fm lives. Only the end-to-end tests change it (to a fake one). */
  apiUrl?: string;
  userAgent: string;
  /** Lets tests replace the real network with saved answers. */
  fetch?: typeof fetch;
  /** Lets tests control the clock for the cache. */
  now?: () => number;
};

export class LastfmClient implements LastfmSource {
  isSample() {
    return false;
  }

  private readonly fetch: typeof fetch;
  private readonly cache: TtlCache<TopAlbum[]>;

  constructor(private readonly options: LastfmClientOptions) {
    this.fetch = options.fetch ?? fetch;
    this.cache = new TtlCache(200, options.now);
  }

  async getTopAlbums(username: string, period: StreamingPeriod): Promise<TopAlbum[]> {
    const cacheKey = `${username.toLowerCase()}|${period}`;
    const cached = this.cache.get(cacheKey);
    if (cached !== undefined) return cached;

    const params = new URLSearchParams({
      method: 'user.gettopalbums',
      user: username,
      period,
      limit: String(LIMIT),
      api_key: this.options.apiKey,
      format: 'json',
    });

    let res: Response;
    try {
      res = await this.fetch(`${this.options.apiUrl ?? DEFAULT_API_URL}?${params}`, {
        headers: { 'User-Agent': this.options.userAgent, Accept: 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw unavailableError();
    }

    const body: unknown = await res.json().catch(() => undefined);
    // Last.fm reports problems as { error: <number>, message }, whatever the status.
    const errorCode = z.object({ error: z.number() }).safeParse(body).data?.error;
    if (errorCode === 6 || res.status === 404) {
      throw new LastfmError(
        404,
        'LASTFM_USER_NOT_FOUND',
        `Last.fm has no user called “${username}”. Check the spelling.`,
      );
    }
    if (errorCode === 10 || errorCode === 26 || res.status === 403) {
      throw new LastfmError(
        502,
        'LASTFM_AUTH',
        'Last.fm rejected the API key. Check LASTFM_API_KEY in the .env file.',
      );
    }
    if (errorCode === 29 || res.status === 429) {
      throw new LastfmError(
        503,
        'LASTFM_BUSY',
        'Last.fm is getting a lot of requests from this app. Try again in a minute.',
      );
    }
    if (errorCode !== undefined || !res.ok) throw unavailableError();

    const parsed = rawTopAlbumsSchema.safeParse(body);
    if (!parsed.success) {
      throw new LastfmError(502, 'LASTFM_BAD_RESPONSE', 'Last.fm sent an answer we did not expect');
    }

    const albums = parsed.data.topalbums.album.map((album, index): TopAlbum => {
      // Covers come in several sizes, smallest first; the last non-empty one is the biggest.
      const cover = album.image.findLast((image) => image['#text'] !== '');
      return {
        rank: album['@attr']?.rank ?? index + 1,
        title: album.name,
        artist: album.artist.name,
        playCount: album.playcount,
        coverImageUrl: cover ? cover['#text'] : null,
        url: album.url ?? null,
      };
    });

    this.cache.set(cacheKey, albums, TOP_ALBUMS_TTL);
    return albums;
  }
}

function unavailableError() {
  return new LastfmError(502, 'LASTFM_UNAVAILABLE', "Couldn't reach Last.fm. Try again later.");
}
