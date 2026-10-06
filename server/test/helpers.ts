// ============================================================================
// helpers.ts: SHORTCUTS FOR TESTS
//
// makeTestApp() gives each test a brand-new server with its own temporary,
// in-memory database, so tests never touch your real data or each other.
// recordInput() gives a ready-made valid record that tests can tweak.
// ============================================================================

import type { RecordInput } from '@vinyl/shared';
import { createApp } from '../src/app.js';
import { createDb } from '../src/db/client.js';

/** A fresh app on its own in-memory database, fully migrated. */
export function makeTestApp() {
  const db = createDb(':memory:');
  return { app: createApp({ db }), db };
}

export function recordInput(overrides: Partial<RecordInput> = {}): RecordInput {
  return {
    title: 'Kind of Blue',
    artists: ['Miles Davis'],
    year: 1959,
    format: 'LP',
    runtimeSeconds: 2744,
    genres: ['Jazz'],
    styles: ['Modal'],
    ...overrides,
  };
}
