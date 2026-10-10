// ============================================================================
// index.ts: THE FRONT DOOR OF THE SHARED FOLDER
//
// shared/ holds the "contracts" between the website and the server: exact
// descriptions of what data looks like. Both sides import from here, so they
// always agree. This file just re-exports everything so others can write
// import { ... } from '@vinyl/shared'.
// ============================================================================

export * from './health.js';
export * from './errors.js';
export * from './records.js';
export * from './discogs.js';
export * from './spins.js';
export * from './stats.js';
export * from './settings.js';
export * from './dust.js';
export * from './styluses.js';
export * from './auth.js';
