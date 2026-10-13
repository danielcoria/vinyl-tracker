// ============================================================================
// scrobbling.ts (service): SENDING VINYL PLAYS TO LAST.FM
//
// "Scrobbling" adds played songs to someone's Last.fm history, so records
// count alongside what they stream.
//
//   connectAccount / disconnectAccount / getScrobblingStatus
//       a person's link to their Last.fm account (made by approving the app
//       on Last.fm; see routes/lastfm.ts)
//   scrobbleSpin   sends one play, if it can be sent yet
//   scrobbleDue    sends every play that is waiting and has now finished
//
// What gets sent: one entry per song on the sides that were played, each with
// the time it would have started (the play's start time, plus the lengths of
// the songs before it).
//
// Last.fm's rules decide the rest:
//   - a play can only be sent once it has happened, so "I'm starting now"
//     plays wait ('pending') until they're over
//   - plays from more than two weeks ago are refused, so they're 'skipped'
//   - it works song by song, so a record without a tracklist is 'skipped'
// A play is sent at most once: its state moves on from 'pending' and is never
// tried again.
// ============================================================================

import { and, asc, eq, inArray, lte } from 'drizzle-orm';
import type { ScrobbleState, ScrobblingStatus } from '@vinyl/shared';
import type { Db } from '../db/client.js';
import { lastfmAccounts, records, spins, spinTracks, tracks } from '../db/schema.js';
import {
  LastfmError,
  SCROBBLE_BATCH,
  type LastfmSource,
  type ScrobbleTrack,
} from '../integrations/lastfm/client.js';
import { getRecord } from './records.js';
import { getSettings, updateSettings } from './settings.js';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Last.fm refuses plays older than about two weeks. */
const MAX_AGE_MS = 14 * DAY_MS;
/** Last.fm ignores songs shorter than 30 seconds. */
const MIN_TRACK_SECONDS = 30;

export function getScrobblingStatus(
  db: Db,
  userId: number,
  lastfm: LastfmSource | null,
  { demoAccount = false }: { demoAccount?: boolean } = {},
): ScrobblingStatus {
  const account = db.select().from(lastfmAccounts).where(eq(lastfmAccounts.userId, userId)).get();
  // The shared demo account can't be tied to one person's Last.fm; otherwise the
  // only thing that can be missing is the server's shared secret.
  const unavailableReason = demoAccount
    ? ('demo-account' as const)
    : lastfm?.canScrobble
      ? null
      : ('not-set-up' as const);
  return {
    available: unavailableReason === null,
    unavailableReason,
    connected: Boolean(account),
    username: account?.username ?? null,
  };
}

/** Saves (or replaces) the connection made by approving the app on Last.fm. */
export function connectAccount(
  db: Db,
  userId: number,
  account: { username: string; sessionKey: string },
): void {
  db.insert(lastfmAccounts)
    .values({ userId, ...account })
    .onConflictDoUpdate({
      target: lastfmAccounts.userId,
      set: { ...account, connectedAt: new Date().toISOString() },
    })
    .run();
  // "Streaming vs. shelf" can use the same account, unless one was already chosen.
  if (getSettings(db, userId).lastfmUsername === null) {
    updateSettings(db, userId, { lastfmUsername: account.username });
  }
}

/** Forgets the session key. Plays still waiting will no longer be sent. */
export function disconnectAccount(db: Db, userId: number): void {
  db.transaction((tx) => {
    tx.delete(lastfmAccounts).where(eq(lastfmAccounts.userId, userId)).run();
    const own = tx.select({ id: records.id }).from(records).where(eq(records.userId, userId));
    tx.update(spins)
      .set({ scrobbleState: null })
      .where(and(eq(spins.scrobbleState, 'pending'), inArray(spins.recordId, own)))
      .run();
  });
}

/** True when this person has connected Last.fm (so new plays should be marked to send). */
export function isConnected(db: Db, userId: number): boolean {
  return Boolean(
    db
      .select({ userId: lastfmAccounts.userId })
      .from(lastfmAccounts)
      .where(eq(lastfmAccounts.userId, userId))
      .get(),
  );
}

type Played = { title: string; durationSeconds: number | null };

/**
 * The songs of one play, each with the time it started. Songs without a known
 * length are given an equal share of whatever time is left over.
 */
export function tracksToScrobble(
  play: { playedAt: string; durationSeconds: number },
  album: { title: string; artist: string },
  played: Played[],
): ScrobbleTrack[] {
  const known = played.reduce((sum, t) => sum + (t.durationSeconds ?? 0), 0);
  const unknownCount = played.filter((t) => t.durationSeconds === null).length;
  const share = unknownCount > 0 ? Math.max(0, (play.durationSeconds - known) / unknownCount) : 0;

  let clock = Math.floor(Date.parse(play.playedAt) / 1000);
  const result: ScrobbleTrack[] = [];
  for (const track of played) {
    const length = track.durationSeconds ?? share;
    // Too short for Last.fm to count; the clock still moves past it.
    if (track.durationSeconds === null || track.durationSeconds >= MIN_TRACK_SECONDS) {
      result.push({
        artist: album.artist,
        track: track.title,
        album: album.title,
        timestamp: clock,
        duration: track.durationSeconds,
      });
    }
    clock += Math.round(length);
  }
  return result;
}

/**
 * Sends one play to Last.fm if it's waiting and has finished. Returns its
 * state afterwards (null = it was never meant to be sent).
 */
export async function scrobbleSpin(
  db: Db,
  lastfm: LastfmSource,
  spinId: number,
  now: number = Date.now(),
): Promise<ScrobbleState | null> {
  const spin = db.select().from(spins).where(eq(spins.id, spinId)).get();
  if (!spin || spin.scrobbleState !== 'pending') return spin?.scrobbleState ?? null;

  const setState = (state: ScrobbleState) => {
    db.update(spins).set({ scrobbleState: state }).where(eq(spins.id, spinId)).run();
    return state;
  };

  const start = Date.parse(spin.playedAt);
  if (start + spin.durationSeconds * 1000 > now) return 'pending'; // not over yet
  if (start < now - MAX_AGE_MS) return setState('skipped'); // Last.fm would refuse it

  const owner = db
    .select({ userId: records.userId })
    .from(records)
    .where(eq(records.id, spin.recordId))
    .get();
  const account =
    owner?.userId == null
      ? undefined
      : db.select().from(lastfmAccounts).where(eq(lastfmAccounts.userId, owner.userId)).get();
  if (!owner?.userId || !account) return setState('skipped'); // disconnected in the meantime

  const played = db
    .select({ title: tracks.title, durationSeconds: tracks.durationSeconds })
    .from(spinTracks)
    .innerJoin(tracks, eq(tracks.id, spinTracks.trackId))
    .where(eq(spinTracks.spinId, spinId))
    .orderBy(asc(tracks.sortOrder))
    .all();
  const record = getRecord(db, owner.userId, spin.recordId);
  const artist = record.artists[0]?.name;
  const toSend = artist ? tracksToScrobble(spin, { title: record.title, artist }, played) : [];
  if (toSend.length === 0) return setState('skipped'); // no tracklist to go by

  try {
    let accepted = 0;
    for (let i = 0; i < toSend.length; i += SCROBBLE_BATCH) {
      const result = await lastfm.scrobble(account.sessionKey, toSend.slice(i, i + SCROBBLE_BATCH));
      accepted += result.accepted;
    }
    return setState(accepted > 0 ? 'sent' : 'skipped');
  } catch (error) {
    if (error instanceof LastfmError && error.code === 'LASTFM_SESSION_INVALID') {
      // The person removed the app on Last.fm: forget the connection here too.
      disconnectAccount(db, owner.userId);
      return setState('failed');
    }
    // Last.fm is busy or unreachable: leave it waiting, to be tried again later.
    return 'pending';
  }
}

/** Sends every waiting play that has finished. Returns how many were handled. */
export async function scrobbleDue(
  db: Db,
  lastfm: LastfmSource,
  { now = Date.now(), limit = 20 }: { now?: number; limit?: number } = {},
): Promise<number> {
  const waiting = db
    .select({ id: spins.id, playedAt: spins.playedAt, durationSeconds: spins.durationSeconds })
    .from(spins)
    .where(
      and(eq(spins.scrobbleState, 'pending'), lte(spins.playedAt, new Date(now).toISOString())),
    )
    .orderBy(asc(spins.playedAt))
    .all()
    .filter((spin) => Date.parse(spin.playedAt) + spin.durationSeconds * 1000 <= now)
    .slice(0, limit);

  let handled = 0;
  for (const spin of waiting) {
    const state = await scrobbleSpin(db, lastfm, spin.id, now);
    if (state !== 'pending') handled += 1;
  }
  return handled;
}
