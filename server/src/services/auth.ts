// ============================================================================
// auth.ts (service): ACCOUNTS AND LOGIN SESSIONS
//
//   createUser       make an account (usernames are unique, ignoring capitals).
//                    The very first account also takes over any records and
//                    styluses made before accounts existed.
//   checkLogin       the account for a username + password, or null
//   startSession     log in: makes a random token for the browser's cookie
//   userForSession   who a cookie's token belongs to (null if expired/unknown)
//   endSession       log out
//
// Only a hash of each session token is stored, never the token itself, so a
// copy of the database can't be used to log in as anyone.
// ============================================================================

import { createHash, randomBytes } from 'node:crypto';
import { and, count, eq, gt, isNull, lt, sql } from 'drizzle-orm';
import type { User } from '@vinyl/shared';
import type { Db } from '../db/client.js';
import { records, sessions, styluses, users } from '../db/schema.js';
import { ConflictError } from '../errors.js';
import { hashPassword, verifyPassword } from './passwords.js';

export const SESSION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

type UserRow = typeof users.$inferSelect;

/** What other code may see of an account (never the password hash). */
export function toUser(row: UserRow): User {
  return {
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    createdAt: row.createdAt,
  };
}

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export function findUserByUsername(db: Db, username: string): UserRow | undefined {
  return db
    .select()
    .from(users)
    .where(sql`lower(${users.username}) = lower(${username})`)
    .get();
}

export async function createUser(
  db: Db,
  input: { username: string; password: string; displayName: string | null },
): Promise<User> {
  if (findUserByUsername(db, input.username)) {
    throw new ConflictError('USERNAME_TAKEN', 'That username is taken. Try another one.');
  }
  const passwordHash = await hashPassword(input.password);
  try {
    const row = db
      .insert(users)
      .values({
        username: input.username,
        displayName: input.displayName ?? input.username,
        passwordHash,
      })
      .returning()
      .get();
    claimDataFromBeforeAccounts(db, row.id);
    return toUser(row);
  } catch {
    // Someone took the name in the moment while the password was being hashed.
    throw new ConflictError('USERNAME_TAKEN', 'That username is taken. Try another one.');
  }
}

/**
 * Records and styluses made before accounts existed have no owner. The first
 * account created on the database takes them over, so nothing is lost.
 */
function claimDataFromBeforeAccounts(db: Db, userId: number) {
  const accounts = db.select({ n: count() }).from(users).get()?.n ?? 0;
  if (accounts !== 1) return;
  db.transaction((tx) => {
    tx.update(records).set({ userId }).where(isNull(records.userId)).run();
    tx.update(styluses).set({ userId }).where(isNull(styluses.userId)).run();
  });
}

// Checked when the username doesn't exist, so a wrong username takes as long
// as a wrong password (the time taken doesn't reveal which usernames exist).
let decoyHash: Promise<string> | null = null;

export async function checkLogin(db: Db, username: string, password: string): Promise<User | null> {
  const row = findUserByUsername(db, username);
  if (!row) {
    decoyHash ??= hashPassword('not-a-real-password');
    await verifyPassword(password, await decoyHash);
    return null;
  }
  return (await verifyPassword(password, row.passwordHash)) ? toUser(row) : null;
}

export function startSession(db: Db, userId: number, now = Date.now()) {
  // 32 random bytes: far too many possibilities to guess.
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(now + SESSION_DAYS * DAY_MS);
  db.insert(sessions)
    .values({ id: hashToken(token), userId, expiresAt: expiresAt.toISOString() })
    .run();
  // Tidy up: remove sessions that have run out.
  db.delete(sessions)
    .where(lt(sessions.expiresAt, new Date(now).toISOString()))
    .run();
  return { token, expiresAt };
}

export function userForSession(db: Db, token: string, now = Date.now()): User | null {
  const row = db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(
      and(eq(sessions.id, hashToken(token)), gt(sessions.expiresAt, new Date(now).toISOString())),
    )
    .get();
  return row ? toUser(row.user) : null;
}

export function endSession(db: Db, token: string): void {
  db.delete(sessions)
    .where(eq(sessions.id, hashToken(token)))
    .run();
}
