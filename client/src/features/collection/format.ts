// ============================================================================
// format.ts: TURNS RECORD DATA INTO TEXT FOR THE SCREEN (and back)
//
//   formatArtists   ["Simon", "Garfunkel"]  -> "Simon & Garfunkel"
//   formatDuration  2569 (seconds)          -> "42:49"
//   parseDuration   "42:49"                 -> 2569  (for the form)
//   CONDITION_LABELS  "VG+"                 -> "Very Good Plus"
// ============================================================================

import type { Condition, VinylRecord } from '@vinyl/shared';

export function formatArtists(artists: VinylRecord['artists']): string {
  const names = artists.map((a) => a.name);
  if (names.length <= 1) return names[0] ?? 'Unknown artist';
  return `${names.slice(0, -1).join(', ')} & ${names.at(-1)}`;
}

/** Seconds -> "m:ss", or "h:mm:ss" for an hour or more. */
export function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const ss = String(seconds).padStart(2, '0');
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${ss}`;
  return `${minutes}:${ss}`;
}

/**
 * The opposite of formatDuration. Accepts "42" (minutes), "42:49" or "1:33:57".
 * Returns null if the text isn't a valid length.
 */
export function parseDuration(text: string): number | null {
  const parts = text.trim().split(':');
  if (parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return null;
  const numbers = parts.map(Number);

  // A single number means minutes.
  if (numbers.length === 1) return (numbers[0] ?? 0) * 60;
  // Every part after the first must be 0-59 (minutes and seconds).
  if (numbers.slice(1).some((n) => n > 59)) return null;
  return numbers.reduce((total, n) => total * 60 + n, 0);
}

/** The Goldmine grades spelled out, for menus and the detail page. */
export const CONDITION_LABELS: Record<Condition, string> = {
  M: 'Mint',
  NM: 'Near Mint',
  'VG+': 'Very Good Plus',
  VG: 'Very Good',
  'G+': 'Good Plus',
  G: 'Good',
  F: 'Fair',
  P: 'Poor',
};
