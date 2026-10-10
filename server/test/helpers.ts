// ============================================================================
// helpers.ts: SHORTCUTS FOR TESTS
//
// makeTestApp() gives each test a brand-new server with its own temporary,
// in-memory database and a logged-in test account. Use `api` to make requests
// as that person (it sends their login cookie); `request(app)` is a visitor
// who isn't logged in.
// addUser() makes another account, to check people can't see each other's data.
// recordInput() gives a ready-made valid record that tests can tweak.
// ============================================================================

import request from 'supertest';
import type { RecordInput } from '@vinyl/shared';
import { createApp, type AppDeps } from '../src/app.js';
import { createDb, type Db } from '../src/db/client.js';
import { users } from '../src/db/schema.js';
import { startSession, toUser } from '../src/services/auth.js';

/** Requests sent with one person's login cookie. */
export function loggedIn(app: ReturnType<typeof createApp>, cookie: string) {
  return {
    get: (url: string) => request(app).get(url).set('Cookie', cookie),
    post: (url: string) => request(app).post(url).set('Cookie', cookie),
    put: (url: string) => request(app).put(url).set('Cookie', cookie),
    delete: (url: string) => request(app).delete(url).set('Cookie', cookie),
  };
}

/**
 * Makes an account directly in the database (skipping the slow password hashing;
 * auth.test.ts tests real sign-ups) and logs it in. Returns the user and a cookie.
 */
export function addUser(db: Db, username: string) {
  const row = db
    .insert(users)
    .values({ username, displayName: username, passwordHash: 'not-a-real-hash' })
    .returning()
    .get();
  const { token } = startSession(db, row.id);
  return { user: toUser(row), cookie: `vt_session=${token}` };
}

/**
 * A fresh app on its own in-memory database, fully migrated, with one
 * logged-in account. Pass `discogs` (see discogs-helpers.ts) to turn on the
 * Discogs features.
 */
export function makeTestApp({ discogs = null }: Pick<AppDeps, 'discogs'> = {}) {
  const db = createDb(':memory:');
  const app = createApp({ db, discogs });
  const { user, cookie } = addUser(db, 'tester');
  return { app, db, user, cookie, api: loggedIn(app, cookie) };
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
