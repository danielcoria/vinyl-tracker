// ============================================================================
// lastfm/client.ts: TALKS TO LAST.FM
//
// Last.fm keeps a history of what people stream, and knows which artists are
// alike. This asks it three things:
//   getTopAlbums        which albums did this user play most? (their public
//                       top albums; only the username is needed, no password)
//   getSimilarArtists   which artists are like this one?
//   getArtistTopAlbums  what are this artist's best-known albums?
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
const HOUR = 60 * 60 * 1000;
const TOP_ALBUMS_TTL = HOUR; // someone's top albums change slowly
const ARTIST_TTL = 24 * HOUR; // which artists are alike barely changes at all
const TIMEOUT_MS = 10_000;
const LIMIT = 50;
// Plenty, because many get dropped: artists already owned, and the same artist under other names.
const SIMILAR_LIMIT = 30;
const ARTIST_ALBUMS_LIMIT = 5;

export class LastfmError extends AppError {}

export type TopAlbum = {
  rank: number;
  title: string;
  artist: string;
  playCount: number;
  coverImageUrl: string | null;
  url: string | null;
};

export type SimilarArtist = {
  name: string;
  /** How alike, from 0 to 1 (1 = the closest). */
  match: number;
};

export type ArtistAlbum = {
  title: string;
  artist: string;
  coverImageUrl: string | null;
  url: string | null;
};

export type LastfmSource = {
  /** True when this username's albums are built-in samples rather than a real account's. */
  isSample(username: string): boolean;
  /** True when similar artists and their albums are built-in samples. */
  readonly sampleArtists: boolean;
  getTopAlbums(username: string, period: StreamingPeriod): Promise<TopAlbum[]>;
  /** The most similar first. Empty if Last.fm doesn't know the artist. */
  getSimilarArtists(artist: string): Promise<SimilarArtist[]>;
  /** The best-known first. Empty if Last.fm doesn't know the artist. */
  getArtistTopAlbums(artist: string): Promise<ArtistAlbum[]>;
};

// Only the parts of Last.fm's answers that are used. Numbers often arrive as text.
const rawImages = z.array(z.object({ '#text': z.string(), size: z.string() })).default([]);

const rawTopAlbumsSchema = z.object({
  topalbums: z.object({
    album: z.array(
      z.object({
        name: z.string(),
        playcount: z.coerce.number().int(),
        url: z.string().optional(),
        artist: z.object({ name: z.string() }),
        image: rawImages,
        '@attr': z.object({ rank: z.coerce.number().int() }).optional(),
      }),
    ),
  }),
});

const rawSimilarSchema = z.object({
  similarartists: z.object({
    artist: z.array(z.object({ name: z.string(), match: z.coerce.number() })),
  }),
});

/** Covers come in several sizes, smallest first; the last non-empty one is the biggest. */
function biggestImage(images: z.infer<typeof rawImages>): string | null {
  const cover = images.findLast((image) => image['#text'] !== '');
  return cover ? cover['#text'] : null;
}

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

/** Thrown inside the client when Last.fm says "no such user/artist" (its error 6). */
class NotFound extends Error {}

export class LastfmClient implements LastfmSource {
  readonly sampleArtists = false;
  private readonly fetch: typeof fetch;
  private readonly cache: TtlCache<unknown>;

  constructor(private readonly options: LastfmClientOptions) {
    this.fetch = options.fetch ?? fetch;
    this.cache = new TtlCache(500, options.now);
  }

  isSample() {
    return false;
  }

  async getTopAlbums(username: string, period: StreamingPeriod): Promise<TopAlbum[]> {
    try {
      const data = await this.call(
        { method: 'user.gettopalbums', user: username, period, limit: String(LIMIT) },
        rawTopAlbumsSchema,
        TOP_ALBUMS_TTL,
      );
      return data.topalbums.album.map((album, index) => ({
        rank: album['@attr']?.rank ?? index + 1,
        title: album.name,
        artist: album.artist.name,
        playCount: album.playcount,
        coverImageUrl: biggestImage(album.image),
        url: album.url ?? null,
      }));
    } catch (error) {
      if (!(error instanceof NotFound)) throw error;
      throw new LastfmError(
        404,
        'LASTFM_USER_NOT_FOUND',
        `Last.fm has no user called “${username}”. Check the spelling.`,
      );
    }
  }

  async getSimilarArtists(artist: string): Promise<SimilarArtist[]> {
    try {
      const data = await this.call(
        // autocorrect: Last.fm fixes small spelling differences ("Bjork" -> "Björk").
        { method: 'artist.getsimilar', artist, limit: String(SIMILAR_LIMIT), autocorrect: '1' },
        rawSimilarSchema,
        ARTIST_TTL,
      );
      return data.similarartists.artist.map(({ name, match }) => ({ name, match }));
    } catch (error) {
      // An artist Last.fm has never heard of simply has no similar artists.
      if (error instanceof NotFound) return [];
      throw error;
    }
  }

  async getArtistTopAlbums(artist: string): Promise<ArtistAlbum[]> {
    try {
      const data = await this.call(
        {
          method: 'artist.gettopalbums',
          artist,
          limit: String(ARTIST_ALBUMS_LIMIT),
          autocorrect: '1',
        },
        rawTopAlbumsSchema,
        ARTIST_TTL,
      );
      return (
        data.topalbums.album
          // Last.fm sometimes lists a nameless album, literally called "(null)".
          .filter((album) => album.name !== '' && album.name !== '(null)')
          .map((album) => ({
            title: album.name,
            artist: album.artist.name,
            coverImageUrl: biggestImage(album.image),
            url: album.url ?? null,
          }))
      );
    } catch (error) {
      if (error instanceof NotFound) return [];
      throw error;
    }
  }

  /** One question to Last.fm: remembered for `ttlMs`, checked against `schema`. */
  private async call<T>(
    question: Record<string, string>,
    schema: z.ZodType<T>,
    ttlMs: number,
  ): Promise<T> {
    // The key for remembering the answer: the question, without the API key.
    const cacheKey = new URLSearchParams(question).toString().toLowerCase();
    const cached = this.cache.get(cacheKey);
    if (cached !== undefined) return cached as T;

    const params = new URLSearchParams({
      ...question,
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
    // Last.fm reports problems as { error: <number>, message }, sometimes with status 200.
    const errorCode = z.object({ error: z.number() }).safeParse(body).data?.error;
    if (errorCode === 6 || res.status === 404) throw new NotFound();
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

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new LastfmError(502, 'LASTFM_BAD_RESPONSE', 'Last.fm sent an answer we did not expect');
    }

    this.cache.set(cacheKey, parsed.data, ttlMs);
    return parsed.data;
  }
}

function unavailableError() {
  return new LastfmError(502, 'LASTFM_UNAVAILABLE', "Couldn't reach Last.fm. Try again later.");
}
