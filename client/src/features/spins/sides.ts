// ============================================================================
// sides.ts: WORKING WITH THE SIDES OF A RECORD
//
//   groupBySide(tracks)  [A1, A2, B1] -> side A: [A1, A2], side B: [B1],
//                        each with its total length
//   formatSides(sides)   null -> "Whole record", ["A"] -> "Side A",
//                        ["A", "C"] -> "Sides A & C"
//   playLength(...)      how long the chosen sides last, for the log panel
// ============================================================================

import type { Track } from '@vinyl/shared';

export type SideGroup = {
  /** The side letter, or null for tracks without one. */
  side: string | null;
  tracks: Track[];
  /** Total length, or null if any track's length is unknown. */
  durationSeconds: number | null;
};

export function groupBySide(tracks: Track[]): SideGroup[] {
  const groups: SideGroup[] = [];
  for (const track of tracks) {
    let group = groups.find((g) => g.side === track.side);
    if (!group) {
      group = { side: track.side, tracks: [], durationSeconds: 0 };
      groups.push(group);
    }
    group.tracks.push(track);
  }
  for (const group of groups) group.durationSeconds = totalLength(group.tracks);
  return groups;
}

/** Adds up track lengths; null if any is unknown (a partial total would mislead). */
export function totalLength(tracks: Track[]): number | null {
  let total = 0;
  for (const track of tracks) {
    if (track.durationSeconds === null) return null;
    total += track.durationSeconds;
  }
  return tracks.length > 0 ? total : null;
}

/** The letters of the sides a record has, in order (empty if it has none). */
export function sideLetters(tracks: Track[]): string[] {
  return groupBySide(tracks).flatMap((g) => (g.side === null ? [] : [g.side]));
}

export function formatSides(sides: string[] | null): string {
  if (sides === null) return 'Whole record';
  if (sides.length === 1) return `Side ${sides[0]}`;
  return `Sides ${sides.slice(0, -1).join(', ')} & ${sides.at(-1)}`;
}

/**
 * How long a play of the chosen sides lasts, or null if we can't tell
 * (then the person types it in).
 */
export function playLength(
  tracks: Track[],
  chosenSides: string[],
  recordRuntime: number | null,
): number | null {
  const letters = sideLetters(tracks);
  const wholeRecord = letters.length === 0 || chosenSides.length === letters.length;
  const chosenTracks =
    letters.length === 0 ? tracks : tracks.filter((t) => t.side && chosenSides.includes(t.side));
  // The tracks' own lengths are the most precise; fall back to the album length for a full play.
  return totalLength(chosenTracks) ?? (wholeRecord ? recordRuntime : null);
}
