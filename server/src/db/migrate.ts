// ============================================================================
// migrate.ts: UPDATES THE DATABASE TABLES
//
// Run with: npm run db:migrate -w server
// Applies any new migrations (from server/drizzle/) to your database.
// You rarely need this by hand: the server does it every time it starts.
// ============================================================================

import { loadConfig } from '../config.js';
import { createDb } from './client.js';

const { databasePath } = loadConfig();
createDb(databasePath);
console.log(`Migrations applied to ${databasePath}`);
