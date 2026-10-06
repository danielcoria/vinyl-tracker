import { mkdirSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { SERVER_ROOT } from '../paths.js';
import * as schema from './schema.js';

export type Db = BetterSQLite3Database<typeof schema>;

const MIGRATIONS_DIR = path.join(SERVER_ROOT, 'drizzle');

/**
 * Opens the database and brings its schema up to date.
 * Pass ':memory:' for a throwaway database (tests).
 */
export function createDb(databasePath: string): Db {
  if (databasePath !== ':memory:') {
    mkdirSync(path.dirname(databasePath), { recursive: true });
  }

  const sqlite = new Database(databasePath);
  // SQLite leaves foreign keys off unless asked, per connection.
  sqlite.pragma('foreign_keys = ON');
  if (databasePath !== ':memory:') {
    // WAL lets reads continue while a write is in progress.
    sqlite.pragma('journal_mode = WAL');
  }

  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: MIGRATIONS_DIR });
  return db;
}
