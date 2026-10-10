// ============================================================================
// routes/auth.ts: THE ADDRESSES FOR ACCOUNTS
//
//   GET  /api/auth/me      who is logged in ({ user } or { user: null })
//   POST /api/auth/signup  make an account and log in   { username, password, displayName? }
//   POST /api/auth/login   log in                       { username, password }
//   POST /api/auth/logout  log out
//   POST /api/auth/demo    log in to the shared demo account (only on the demo site)
//
// After 10 wrong passwords from the same address within 15 minutes, logging in
// is paused for that address (so nobody can guess passwords forever).
// ============================================================================

import { eq } from 'drizzle-orm';
import { Router } from 'express';
import { loginInputSchema, signupInputSchema, type ApiError, type MeResponse } from '@vinyl/shared';
import type { Db } from '../db/client.js';
import { demoUserId } from '../db/demo.js';
import { users } from '../db/schema.js';
import { AppError } from '../errors.js';
import { FAILURE_WINDOW_MS, FailureLimiter } from '../middleware/failure-limiter.js';
import {
  clearSessionCookie,
  readCookie,
  SESSION_COOKIE,
  setSessionCookie,
} from '../middleware/session.js';
import { checkLogin, createUser, endSession, startSession, toUser } from '../services/auth.js';

export type AuthOptions = {
  /** Send the cookie only over HTTPS (true online). */
  secureCookies: boolean;
  /** The clock for the guessing limit. Tests pass a fake one. */
  now?: () => number;
  /** On the public demo, "Try the demo" logs visitors into the shared demo account. */
  demo?: boolean;
};

export function authRouter(db: Db, { secureCookies, now, demo = false }: AuthOptions) {
  const router = Router();
  const limiter = new FailureLimiter(now);

  router.get('/me', (req, res) => {
    const body: MeResponse = { user: req.user ?? null };
    res.json(body);
  });

  router.post('/signup', async (req, res) => {
    const input = signupInputSchema.parse(req.body);
    const user = await createUser(db, input);
    const { token } = startSession(db, user.id);
    setSessionCookie(res, token, secureCookies);
    const body: MeResponse = { user };
    res.status(201).json(body);
  });

  router.post('/login', async (req, res) => {
    const address = req.ip ?? 'unknown';
    if (limiter.isBlocked(address)) {
      const body: ApiError = {
        error: {
          code: 'TOO_MANY_ATTEMPTS',
          message: 'Too many wrong passwords. Try again in 15 minutes.',
        },
      };
      res
        .status(429)
        .set('Retry-After', String(FAILURE_WINDOW_MS / 1000))
        .json(body);
      return;
    }

    const { username, password } = loginInputSchema.parse(req.body);
    const user = await checkLogin(db, username, password);
    if (!user) {
      limiter.recordFailure(address);
      // The same message for a wrong username or a wrong password, so it
      // doesn't reveal which usernames exist.
      const body: ApiError = {
        error: { code: 'INVALID_LOGIN', message: 'Wrong username or password.' },
      };
      res.status(401).json(body);
      return;
    }

    limiter.recordSuccess(address);
    const { token } = startSession(db, user.id);
    setSessionCookie(res, token, secureCookies);
    const body: MeResponse = { user };
    res.json(body);
  });

  router.post('/demo', (_req, res) => {
    if (!demo) throw new AppError(404, 'NOT_FOUND', 'There is no demo account on this site.');
    const id = demoUserId(db);
    const row = db.select().from(users).where(eq(users.id, id)).get();
    if (!row) throw new Error('The demo account is missing');
    const { token } = startSession(db, id);
    setSessionCookie(res, token, secureCookies);
    const body: MeResponse = { user: toUser(row) };
    res.json(body);
  });

  router.post('/logout', (req, res) => {
    const token = readCookie(req.headers.cookie, SESSION_COOKIE);
    if (token) endSession(db, token);
    clearSessionCookie(res, secureCookies);
    res.status(204).end();
  });

  return router;
}
