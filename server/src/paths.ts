// ============================================================================
// paths.ts: WHERE THINGS ARE ON DISK
//
// Works out the full folder paths of the server folder and the whole
// project, so other files can find .env, the database and migrations
// no matter which folder you started the app from.
// ============================================================================

import { fileURLToPath } from 'node:url';

// This file sits directly in server/src/, and tsup bundles everything into
// server/dist/index.js, so '..' is server/ in both dev and the built app.
// Any module that needs a filesystem path should derive it from here.
export const SERVER_ROOT = fileURLToPath(new URL('..', import.meta.url));
export const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));
