// ============================================================================
// schema.ts: THE DATABASE TABLES
//
// A database is like a set of spreadsheets ("tables"). Each table has
// columns, and each row is one item. Our tables:
//   records        one row per record you own (title, year, label, condition...)
//   artists        one row per artist
//   record_artists links records to artists (a record can have several)
//   record_tags    the genres and styles of each record
// When this file changes, run "npm run db:generate -w server" to create a
// "migration": a file of instructions that updates the real database to match.
// ============================================================================

import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { CONDITION_GRADES } from '@vinyl/shared';

const now = () => new Date().toISOString();

export const records = sqliteTable(
  'records',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    // Null for manually entered records. Unique so a release is imported once.
    discogsReleaseId: integer('discogs_release_id').unique(),
    title: text('title').notNull(),
    year: integer('year'),
    label: text('label'),
    catalogNumber: text('catalog_number'),
    format: text('format'),
    coverImageUrl: text('cover_image_url'),
    runtimeSeconds: integer('runtime_seconds'),
    mediaCondition: text('media_condition', { enum: CONDITION_GRADES }),
    sleeveCondition: text('sleeve_condition', { enum: CONDITION_GRADES }),
    notes: text('notes'),
    addedAt: text('added_at').notNull().$defaultFn(now),
    updatedAt: text('updated_at').notNull().$defaultFn(now),
  },
  (t) => [index('records_added_at_idx').on(t.addedAt)],
);

export const artists = sqliteTable(
  'artists',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    discogsArtistId: integer('discogs_artist_id').unique(),
    name: text('name').notNull(),
  },
  // Case-insensitive, so "radiohead" and "Radiohead" are the same artist.
  (t) => [uniqueIndex('artists_name_lower_idx').on(sql`lower(${t.name})`)],
);

export const recordArtists = sqliteTable(
  'record_artists',
  {
    recordId: integer('record_id')
      .notNull()
      .references(() => records.id, { onDelete: 'cascade' }),
    artistId: integer('artist_id')
      .notNull()
      .references(() => artists.id, { onDelete: 'restrict' }),
    /** 0 = primary artist; used for credit order and sort-by-artist. */
    position: integer('position').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.recordId, t.position] }),
    index('record_artists_artist_idx').on(t.artistId),
  ],
);

export const TAG_KINDS = ['genre', 'style'] as const;

export const recordTags = sqliteTable(
  'record_tags',
  {
    recordId: integer('record_id')
      .notNull()
      .references(() => records.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: TAG_KINDS }).notNull(),
    name: text('name').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.recordId, t.kind, t.name] }),
    index('record_tags_kind_name_idx').on(t.kind, t.name),
  ],
);
