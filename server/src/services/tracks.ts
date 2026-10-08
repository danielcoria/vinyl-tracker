// ============================================================================
// tracks.ts (service): A RECORD'S TRACKLIST
//
//   getTracks      the songs on a record, in order
//   replaceTracks  save a tracklist from Discogs. If the current tracklist is
//                  already used by logged plays, it's kept instead, so the
//                  diary never loses which songs were played.
// ============================================================================

import { asc, eq, inArray } from 'drizzle-orm';
import type { Track } from '@vinyl/shared';
import type { Db } from '../db/client.js';
import { spinTracks, tracks } from '../db/schema.js';
import type { MappedTrack } from '../integrations/discogs/mapping.js';

export function getTracks(db: Db, recordId: number): Track[] {
  return db
    .select({
      id: tracks.id,
      position: tracks.position,
      side: tracks.side,
      title: tracks.title,
      durationSeconds: tracks.durationSeconds,
    })
    .from(tracks)
    .where(eq(tracks.recordId, recordId))
    .orderBy(asc(tracks.sortOrder))
    .all();
}

/** Returns true if the tracklist was saved, false if the existing one was kept. */
export function replaceTracks(db: Db, recordId: number, newTracks: MappedTrack[]): boolean {
  return db.transaction((tx) => {
    const existingIds = tx
      .select({ id: tracks.id })
      .from(tracks)
      .where(eq(tracks.recordId, recordId))
      .all()
      .map((t) => t.id);

    if (existingIds.length > 0) {
      const usedByPlays = tx
        .select({ trackId: spinTracks.trackId })
        .from(spinTracks)
        .where(inArray(spinTracks.trackId, existingIds))
        .limit(1)
        .get();
      if (usedByPlays) return false;
      tx.delete(tracks).where(eq(tracks.recordId, recordId)).run();
    }

    if (newTracks.length > 0) {
      tx.insert(tracks)
        .values(newTracks.map((track) => ({ ...track, recordId })))
        .run();
    }
    return true;
  });
}
