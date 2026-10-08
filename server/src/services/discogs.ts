// ============================================================================
// discogs.ts (service): SEARCH DISCOGS, IMPORT A RELEASE, LINK A RECORD
//
//   searchDiscogs   search, and mark results that are already in the collection
//   importRelease   add a Discogs release to the collection as a new record
//   linkRecord      connect a record you already have to its Discogs release:
//                   fills in the cover and any empty details, but never
//                   overwrites what you typed yourself
// ============================================================================

import { eq, inArray } from 'drizzle-orm';
import {
  recordInputSchema,
  type DiscogsLinkInput,
  type DiscogsSearchResponse,
  type VinylRecord,
} from '@vinyl/shared';
import type { Db } from '../db/client.js';
import { records } from '../db/schema.js';
import { ConflictError } from '../errors.js';
import type { DiscogsClient } from '../integrations/discogs/client.js';
import { releaseToRecordInput, toSearchResult } from '../integrations/discogs/mapping.js';
import { createRecord, getRecord, updateRecord } from './records.js';

export async function searchDiscogs(
  db: Db,
  discogs: DiscogsClient,
  query: { q: string; page: number },
): Promise<DiscogsSearchResponse> {
  const raw = await discogs.search(query.q, query.page);
  const results = raw.results.map(toSearchResult);

  // One query to find which of these releases are already in the collection.
  const releaseIds = results.map((r) => r.releaseId);
  const owned =
    releaseIds.length === 0
      ? []
      : db
          .select({ id: records.id, releaseId: records.discogsReleaseId })
          .from(records)
          .where(inArray(records.discogsReleaseId, releaseIds))
          .all();
  const recordIdByRelease = new Map(owned.map((row) => [row.releaseId, row.id]));

  return {
    results: results.map((r) => ({
      ...r,
      inCollectionId: recordIdByRelease.get(r.releaseId) ?? null,
    })),
    page: raw.pagination.page,
    pages: raw.pagination.pages,
  };
}

export async function importRelease(
  db: Db,
  discogs: DiscogsClient,
  releaseId: number,
): Promise<VinylRecord> {
  assertNotInCollection(db, releaseId);
  const release = await discogs.getRelease(releaseId);
  const input = recordInputSchema.parse(releaseToRecordInput(release));
  return createRecord(db, input, { discogsReleaseId: releaseId });
}

export async function linkRecord(
  db: Db,
  discogs: DiscogsClient,
  { recordId, releaseId }: DiscogsLinkInput,
): Promise<VinylRecord> {
  const record = getRecord(db, recordId); // 404 if it doesn't exist
  if (record.discogsReleaseId !== releaseId) assertNotInCollection(db, releaseId);

  const release = await discogs.getRelease(releaseId);
  const fromDiscogs = recordInputSchema.parse(releaseToRecordInput(release));

  // Keep everything already filled in; use Discogs only for the gaps.
  const merged = recordInputSchema.parse({
    title: record.title,
    artists: record.artists.map((a) => a.name),
    year: record.year ?? fromDiscogs.year,
    label: record.label ?? fromDiscogs.label,
    catalogNumber: record.catalogNumber ?? fromDiscogs.catalogNumber,
    format: record.format ?? fromDiscogs.format,
    coverImageUrl: record.coverImageUrl ?? fromDiscogs.coverImageUrl,
    runtimeSeconds: record.runtimeSeconds ?? fromDiscogs.runtimeSeconds,
    mediaCondition: record.mediaCondition,
    sleeveCondition: record.sleeveCondition,
    notes: record.notes,
    genres: record.genres.length > 0 ? record.genres : fromDiscogs.genres,
    styles: record.styles.length > 0 ? record.styles : fromDiscogs.styles,
  });

  updateRecord(db, recordId, merged);
  db.update(records).set({ discogsReleaseId: releaseId }).where(eq(records.id, recordId)).run();
  return getRecord(db, recordId);
}

function assertNotInCollection(db: Db, releaseId: number) {
  const existing = db
    .select({ id: records.id })
    .from(records)
    .where(eq(records.discogsReleaseId, releaseId))
    .get();
  if (existing) {
    throw new ConflictError(
      'ALREADY_IN_COLLECTION',
      `This release is already in your collection (record ${existing.id})`,
    );
  }
}
