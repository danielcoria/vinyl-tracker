// ============================================================================
// drizzle.config.ts: SETTINGS FOR DRIZZLE KIT (database tools)
//
// Tells "npm run db:generate" where the table definitions are and where to
// write new migrations, and tells "npm run db:studio" which database to open.
// ============================================================================

import { defineConfig } from 'drizzle-kit';
import { loadConfig } from './src/config.js';

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.ts',
  out: './drizzle',
  // Only used by `npm run db:studio`; the app opens the database itself.
  dbCredentials: { url: loadConfig().databasePath },
});
