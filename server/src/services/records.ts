// ============================================================================
// records.ts: THE REAL WORK FOR RECORDS (the "service")
//
// Routes receive requests; services do the actual work. This file reads
// and writes records in the database: list (with search and sort), get one,
// create, update and delete.
//
// It uses Drizzle, a library that lets us write database queries in
// TypeScript, e.g. db.select().from(records).where(...), instead of raw SQL
// text (some complex parts still use SQL via the sql`...` helper).
//
// A "transaction" (db.transaction) groups several changes so they either ALL
// happen or NONE do. That way a crash can never leave a half-saved record.
// ============================================================================

import { asc, count, desc, eq, inArray, max, notInArray, sql, type SQL } from 'drizzle-orm';
import type { ParsedRecordInput, ParsedRecordListQuery, VinylRecord } from '@vinyl/shared';
import type { Db } from '../db/client.js';
import { artists, recordArtists, records, recordTags, spins } from '../db/schema.js';
import { NotFoundError } from '../errors.js';

// Drizzle's transaction handle has the same query API as the db itself.
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
type RecordRow = typeof records.$inferSelect;

/** Extra fields only the server sets (e.g. from a Discogs import in M4). */
export type RecordSource = { discogsReleaseId?: number | null };

const primaryArtistName = sql<string>`(
  SELECT a.name FROM record_artists ra JOIN artists a ON a.id = ra.artist_id
  WHERE ra.record_id = ${records.id} AND ra.position = 0
)`;

/**
 * Escapes LIKE wildcards so a search for "100%" matches literally.
 * '!' is the escape character (paired with ESCAPE '!' below); unlike a
 * backslash it needs no escaping itself in JS strings or SQL.
 */
function containsPattern(term: string) {
  return `%${term.replace(/[!%_]/g, '!$&')}%`;
}

function searchCondition(term: string): SQL {
  const pattern = containsPattern(term);
  // SQLite's LIKE is case-insensitive for ASCII.
  return sql`(
    ${records.title} LIKE ${pattern} ESCAPE '!'
    OR EXISTS (
      SELECT 1 FROM record_artists ra JOIN artists a ON a.id = ra.artist_id
      WHERE ra.record_id = ${records.id} AND a.name LIKE ${pattern} ESCAPE '!'
    )
  )`;
}

const ORDER_BY: Record<ParsedRecordListQuery['sort'], SQL[]> = {
  added: [desc(records.addedAt), desc(records.id)],
  artist: [
    sql`${primaryArtistName} COLLATE NOCASE`,
    sql`${records.year} ASC NULLS LAST`,
    sql`${records.title} COLLATE NOCASE`,
  ],
  title: [sql`${records.title} COLLATE NOCASE`, asc(records.id)],
  year: [sql`${records.year} ASC NULLS LAST`, sql`${records.title} COLLATE NOCASE`],
};

export function listRecords(db: Db, query: ParsedRecordListQuery): VinylRecord[] {
  const rows = db
    .select()
    .from(records)
    .where(query.q ? searchCondition(query.q) : undefined)
    .orderBy(...ORDER_BY[query.sort])
    .all();
  return hydrate(db, rows);
}

export function getRecord(db: Db, id: number): VinylRecord {
  const row = db.select().from(records).where(eq(records.id, id)).get();
  if (!row) throw new NotFoundError(`Record ${id} not found`);
  const [record] = hydrate(db, [row]);
  if (!record) throw new Error(`Failed to load record ${id}`); // hydrate keeps every row
  return record;
}

export function createRecord(
  db: Db,
  input: ParsedRecordInput,
  source: RecordSource = {},
): VinylRecord {
  // One timestamp for both, so a new record never looks edited.
  const now = new Date().toISOString();
  const id = db.transaction((tx) => {
    const { id } = tx
      .insert(records)
      .values({
        ...recordColumns(input),
        discogsReleaseId: source.discogsReleaseId ?? null,
        addedAt: now,
        updatedAt: now,
      })
      .returning({ id: records.id })
      .get();
    writeCreditsAndTags(tx, id, input);
    return id;
  });
  return getRecord(db, id);
}

/** Full replace: artists, genres and styles are rewritten from the input. */
export function updateRecord(db: Db, id: number, input: ParsedRecordInput): VinylRecord {
  db.transaction((tx) => {
    const updated = tx
      .update(records)
      .set({ ...recordColumns(input), updatedAt: new Date().toISOString() })
      .where(eq(records.id, id))
      .returning({ id: records.id })
      .get();
    if (!updated) throw new NotFoundError(`Record ${id} not found`);

    tx.delete(recordArtists).where(eq(recordArtists.recordId, id)).run();
    tx.delete(recordTags).where(eq(recordTags.recordId, id)).run();
    writeCreditsAndTags(tx, id, input);
    deleteOrphanArtists(tx);
  });
  return getRecord(db, id);
}

export function deleteRecord(db: Db, id: number): void {
  db.transaction((tx) => {
    // Credits and tags go with it via ON DELETE CASCADE.
    const deleted = tx
      .delete(records)
      .where(eq(records.id, id))
      .returning({ id: records.id })
      .get();
    if (!deleted) throw new NotFoundError(`Record ${id} not found`);
    deleteOrphanArtists(tx);
  });
}

function recordColumns(input: ParsedRecordInput) {
  return {
    title: input.title,
    year: input.year,
    label: input.label,
    catalogNumber: input.catalogNumber,
    format: input.format,
    coverImageUrl: input.coverImageUrl,
    runtimeSeconds: input.runtimeSeconds,
    mediaCondition: input.mediaCondition,
    sleeveCondition: input.sleeveCondition,
    notes: input.notes,
  };
}

function writeCreditsAndTags(tx: Tx, recordId: number, input: ParsedRecordInput) {
  // The same artist twice on one record would only duplicate the credit.
  const artistIds = [...new Set(input.artists.map((name) => findOrCreateArtist(tx, name)))];
  if (artistIds.length > 0) {
    tx.insert(recordArtists)
      .values(artistIds.map((artistId, position) => ({ recordId, artistId, position })))
      .run();
  }

  const tags = [
    ...input.genres.map((name) => ({ recordId, kind: 'genre' as const, name })),
    ...input.styles.map((name) => ({ recordId, kind: 'style' as const, name })),
  ];
  if (tags.length > 0) tx.insert(recordTags).values(tags).run();
}

function findOrCreateArtist(tx: Tx, name: string): number {
  const existing = tx
    .select({ id: artists.id })
    .from(artists)
    .where(sql`lower(${artists.name}) = lower(${name})`)
    .get();
  if (existing) return existing.id;
  return tx.insert(artists).values({ name }).returning({ id: artists.id }).get().id;
}

/** Artists with no records left would otherwise linger in search and stats. */
function deleteOrphanArtists(tx: Tx) {
  const credited = tx.select({ id: recordArtists.artistId }).from(recordArtists);
  tx.delete(artists).where(notInArray(artists.id, credited)).run();
}

/** Several records at once, by id (in no particular order). Missing ids are skipped. */
export function getRecordsByIds(db: Db, ids: number[]): VinylRecord[] {
  if (ids.length === 0) return [];
  return hydrate(db, db.select().from(records).where(inArray(records.id, ids)).all());
}

/**
 * Attaches artists, genres, styles and play counts in three queries instead of
 * several per record.
 */
function hydrate(db: Db, rows: RecordRow[]): VinylRecord[] {
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);

  const credits = db
    .select({
      recordId: recordArtists.recordId,
      id: artists.id,
      name: artists.name,
    })
    .from(recordArtists)
    .innerJoin(artists, eq(artists.id, recordArtists.artistId))
    .where(inArray(recordArtists.recordId, ids))
    .orderBy(recordArtists.position)
    .all();

  const tags = db
    .select()
    .from(recordTags)
    .where(inArray(recordTags.recordId, ids))
    .orderBy(sql`${recordTags.name} COLLATE NOCASE`)
    .all();

  type Details = Pick<VinylRecord, 'artists' | 'genres' | 'styles'>;
  const byRecord = new Map<number, Details>();
  const detailsFor = (recordId: number) => {
    let details = byRecord.get(recordId);
    if (!details) {
      details = { artists: [], genres: [], styles: [] };
      byRecord.set(recordId, details);
    }
    return details;
  };

  for (const { recordId, id, name } of credits) detailsFor(recordId).artists.push({ id, name });
  for (const { recordId, kind, name } of tags) {
    const details = detailsFor(recordId);
    (kind === 'genre' ? details.genres : details.styles).push(name);
  }

  // How many times each record was played, and when it was last played.
  const plays = db
    .select({
      recordId: spins.recordId,
      spinCount: count(),
      lastPlayedAt: max(spins.playedAt),
    })
    .from(spins)
    .where(inArray(spins.recordId, ids))
    .groupBy(spins.recordId)
    .all();
  const playsByRecord = new Map(plays.map((p) => [p.recordId, p]));

  return rows.map((row) => ({
    ...row,
    ...detailsFor(row.id),
    spinCount: playsByRecord.get(row.id)?.spinCount ?? 0,
    lastPlayedAt: playsByRecord.get(row.id)?.lastPlayedAt ?? null,
  }));
}
