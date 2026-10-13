// ============================================================================
// routes/lastfm.ts: THE ADDRESSES FOR CONNECTING A LAST.FM ACCOUNT (scrobbling)
//
//   GET    /api/lastfm/status       is scrobbling available, and connected?
//   GET    /api/lastfm/connect      sends the browser to Last.fm to approve the app
//   GET    /api/lastfm/callback/<state>  where Last.fm sends the browser back afterwards
//   DELETE /api/lastfm/connection   disconnect
//
// "connect" and "callback" are visited by the browser itself (not by the
// website's code), so instead of JSON they answer with a redirect back to the
// Streaming page, with ?scrobbling=connected (or why it didn't work).
//
// Connecting, step by step:
//   1. /connect puts a random "state" value in a short-lived cookie, and sends
//      the browser to Last.fm with a return address that carries the same value.
//   2. The person approves the app on Last.fm, which sends the browser back to
//      /callback with a one-time token.
//   3. /callback checks the state matches the cookie (so a link made by someone
//      else can't connect THEIR Last.fm to your account), swaps the token for a
//      session key, and saves it.
// ============================================================================

import { randomBytes, timingSafeEqual } from 'node:crypto';
import { Router, type Request } from 'express';
import type { Db } from '../db/client.js';
import { DEMO_USERNAME } from '../db/demo.js';
import type { LastfmSource } from '../integrations/lastfm/client.js';
import { readCookie, userIdOf } from '../middleware/session.js';
import { connectAccount, disconnectAccount, getScrobblingStatus } from '../services/scrobbling.js';

const STATE_COOKIE = 'vt_lastfm_state';
const STATE_MINUTES = 10;

type Options = { lastfm: LastfmSource | null; demo: boolean; secureCookies: boolean };

/** The address the browser used for this site, e.g. "https://example.com" (also behind a proxy). */
function siteOrigin(req: Request): string {
  const first = (value: string | string[] | undefined) =>
    (Array.isArray(value) ? value[0] : value)?.split(',')[0]?.trim();
  const host = first(req.headers['x-forwarded-host']) ?? req.headers.host ?? 'localhost';
  const protocol = first(req.headers['x-forwarded-proto']) ?? req.protocol;
  return `${protocol}://${host}`;
}

export function lastfmRouter(db: Db, { lastfm, demo, secureCookies }: Options) {
  const router = Router();
  const isDemoAccount = (req: Request) => demo && req.user?.username === DEMO_USERNAME;
  const back = (result: string) => `/streaming?scrobbling=${result}`;
  const cookieOptions = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: secureCookies,
    path: '/api/lastfm',
  };

  router.get('/status', (req, res) => {
    const userId = userIdOf(req);
    res.json(getScrobblingStatus(db, userId, lastfm, { demoAccount: isDemoAccount(req) }));
  });

  router.get('/connect', (req, res) => {
    if (!req.user) return res.redirect('/login');
    if (!lastfm?.canScrobble || isDemoAccount(req)) return res.redirect(back('unavailable'));

    const state = randomBytes(24).toString('base64url');
    res.cookie(STATE_COOKIE, state, { ...cookieOptions, maxAge: STATE_MINUTES * 60 * 1000 });
    // The state goes in the path (not after a "?"), so Last.fm can simply add "?token=...".
    const callback = `${siteOrigin(req)}/api/lastfm/callback/${state}`;
    res.redirect(lastfm.authorizeUrl(callback));
  });

  router.get(['/callback', '/callback/:state'], async (req, res) => {
    if (!req.user) return res.redirect('/login');
    if (!lastfm?.canScrobble || isDemoAccount(req)) return res.redirect(back('unavailable'));

    const expected = readCookie(req.headers.cookie, STATE_COOKIE);
    res.clearCookie(STATE_COOKIE, cookieOptions);
    const state = typeof req.params.state === 'string' ? req.params.state : '';
    const token = typeof req.query.token === 'string' ? req.query.token : '';
    const stateMatches =
      expected !== null &&
      expected.length === state.length &&
      timingSafeEqual(Buffer.from(expected), Buffer.from(state));
    // No token = the person pressed "No" on Last.fm, or opened this address by hand.
    if (!stateMatches || token === '') return res.redirect(back('failed'));

    try {
      connectAccount(db, req.user.id, await lastfm.getSession(token));
      res.redirect(back('connected'));
    } catch {
      res.redirect(back('failed'));
    }
  });

  router.delete('/connection', (req, res) => {
    disconnectAccount(db, userIdOf(req));
    res.status(204).end();
  });

  return router;
}
