// ============================================================================
// spins.ts (service): THE LISTENING DIARY
//
//   createSpin  log a play: which sides (or the whole record), when it
//               started, how long. Also remembers which tracks that covered.
//   listSpins   the diary, newest first (optionally for one record)
//   deleteSpin  remove a play logged by mistake
// ============================================================================

import { desc, eq } from 'drizzle-orm';
import type { ParsedSpinInput, Spin } from '@vinyl/shared';
import type { Db } from '../db/client.js';
import { spins, spinTracks } from '../db/schema.js';
import { AppError, NotFoundError } from '../errors.js';
import { getRecord, getRecordsByIds } from './records.js';
import { getTracks } from './tracks.js';

type SpinRow = typeof spins.$inferSelect;

export function createSpin(db: Db, input: ParsedSpinInput): Spin {
  getRecord(db, input.recordId); // 404 if the record doesn't exist
  const tracklist = getTracks(db, input.recordId);

  // Sides in the order they appear on the record (A before B), without repeats.
  const recordSides = [...new Set(tracklist.map((t) => t.side).filter((s) => s !== null))];
  let sides: string[] | null = null;
  if (input.sides) {
    if (recordSides.length === 0) {
      throw new AppError(400, 'NO_SIDES', "This record's tracklist has no sides to choose from");
    }
    const unknown = input.sides.find((side) => !recordSides.includes(side));
    if (unknown) throw new AppError(400, 'UNKNOWN_SIDE', `Side ${unknown} isn't on this record`);
    sides = recordSides.filter((side) => input.sides?.includes(side));
  }

  // Every side picked = the whole record. Stored as null so "whole" means one thing.
  if (sides && sides.length === recordSides.length) sides = null;
  const playedTracks = sides
    ? tracklist.filter((t) => t.side && sides.includes(t.side))
    : tracklist;

  const id = db.transaction((tx) => {
    const { id } = tx
      .insert(spins)
      .values({
        recordId: input.recordId,
        playedAt: new Date(input.playedAt).toISOString(),
        durationSeconds: input.durationSeconds,
        sides: sides ? sides.join(',') : null,
        notes: input.notes,
      })
      .returning({ id: spins.id })
      .get();
    if (playedTracks.length > 0) {
      tx.insert(spinTracks)
        .values(playedTracks.map((track) => ({ spinId: id, trackId: track.id })))
        .run();
    }
    return id;
  });

  const row = db.select().from(spins).where(eq(spins.id, id)).get();
  if (!row) throw new Error(`Failed to load spin ${id}`);
  const [spin] = withRecords(db, [row]);
  if (!spin) throw new Error(`Failed to load spin ${id}`);
  return spin;
}

export function listSpins(db: Db, query: { recordId?: number; limit: number }): Spin[] {
  const rows = db
    .select()
    .from(spins)
    .where(query.recordId ? eq(spins.recordId, query.recordId) : undefined)
    .orderBy(desc(spins.playedAt), desc(spins.id))
    .limit(query.limit)
    .all();
  return withRecords(db, rows);
}

export function deleteSpin(db: Db, id: number): void {
  // The list of tracks it covered goes with it (ON DELETE CASCADE).
  const deleted = db.delete(spins).where(eq(spins.id, id)).returning({ id: spins.id }).get();
  if (!deleted) throw new NotFoundError(`Play ${id} not found`);
}

/** Attaches a short summary of each spin's record (one query for all of them). */
function withRecords(db: Db, rows: SpinRow[]): Spin[] {
  const recordIds = [...new Set(rows.map((row) => row.recordId))];
  const recordsById = new Map(getRecordsByIds(db, recordIds).map((r) => [r.id, r]));

  return rows.flatMap((row) => {
    const record = recordsById.get(row.recordId);
    if (!record) return []; // can't happen: deleting a record deletes its spins
    return [
      {
        id: row.id,
        playedAt: row.playedAt,
        durationSeconds: row.durationSeconds,
        sides: row.sides ? row.sides.split(',') : null,
        notes: row.notes,
        record: {
          id: record.id,
          title: record.title,
          artists: record.artists,
          coverImageUrl: record.coverImageUrl,
        },
      },
    ];
  });
}
