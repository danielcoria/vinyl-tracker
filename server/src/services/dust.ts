// ============================================================================
// dust.ts (service): THE DUST REPORT
//
// Goes through the collection and sorts out the records you aren't playing:
//   - dusty: last played more than N days ago (N = the saved threshold,
//     90 by default), longest-forgotten first
//   - never played: no plays at all, longest-owned first
// Records played within the last N days aren't listed.
// ============================================================================

import type { DustRecord, DustReport, VinylRecord } from '@vinyl/shared';
import type { Db } from '../db/client.js';
import { listRecords } from './records.js';
import { getSettings } from './settings.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export function getDustReport(
  db: Db,
  query: { days?: number },
  /** The current time. Tests pass a fixed one. */
  now: number = Date.now(),
): DustReport {
  const thresholdDays = query.days ?? getSettings(db).dustThresholdDays;
  const cutoff = now - thresholdDays * DAY_MS;
  const collection = listRecords(db, { sort: 'added' });

  const daysSince = (iso: string) => Math.max(0, Math.floor((now - Date.parse(iso)) / DAY_MS));
  const toDust = (record: VinylRecord): DustRecord => ({
    record: {
      id: record.id,
      title: record.title,
      artists: record.artists,
      coverImageUrl: record.coverImageUrl,
    },
    addedAt: record.addedAt,
    lastPlayedAt: record.lastPlayedAt,
    spinCount: record.spinCount,
    days: daysSince(record.lastPlayedAt ?? record.addedAt),
  });

  const dusty = collection
    .filter((r) => r.lastPlayedAt !== null && Date.parse(r.lastPlayedAt) < cutoff)
    .map(toDust)
    .sort((a, b) => b.days - a.days);

  const neverPlayed = collection
    .filter((r) => r.lastPlayedAt === null)
    .map(toDust)
    .sort((a, b) => b.days - a.days || a.record.title.localeCompare(b.record.title));

  return { thresholdDays, collectionCount: collection.length, dusty, neverPlayed };
}
