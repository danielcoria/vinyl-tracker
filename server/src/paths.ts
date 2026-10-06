import { fileURLToPath } from 'node:url';

// This file sits directly in server/src/, and tsup bundles everything into
// server/dist/index.js, so '..' is server/ in both dev and the built app.
// Any module that needs a filesystem path should derive it from here.
export const SERVER_ROOT = fileURLToPath(new URL('..', import.meta.url));
export const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));
