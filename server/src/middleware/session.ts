// ============================================================================
// session.ts: WHO IS MAKING THIS REQUEST?
//
//   loadUser      reads the login cookie and puts the account on req.user
//                 (null when nobody is logged in)
//   requireUser   answers "401: log in first" unless someone is logged in
//   sameOrigin    refuses changes (POST/PUT/DELETE) sent from other websites
//
// The cookie is "httpOnly" (the page's JavaScript can't read it, so a bug
// can't leak it), "SameSite=Lax" (other sites can't send it along with their
// own requests), and "Secure" online (only sent over HTTPS).
// ============================================================================

import type { CookieOptions, RequestHandler, Response } from 'express';
import type { ApiError, User } from '@vinyl/shared';
import type { Db } from '../db/client.js';
import { AppError } from '../errors.js';
import { SESSION_DAYS, userForSession } from '../services/auth.js';

export const SESSION_COOKIE = 'vt_session';

// Lets TypeScript know that requests carry the logged-in user.
declare module 'express-serve-static-core' {
  interface Request {
    user?: User | null;
  }
}

/** The value of one cookie from the request's Cookie header. */
export function readCookie(header: string | undefined, name: string): string | null {
  for (const part of header?.split(';') ?? []) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

export function loadUser(db: Db): RequestHandler {
  return (req, _res, next) => {
    const token = readCookie(req.headers.cookie, SESSION_COOKIE);
    req.user = token ? userForSession(db, token) : null;
    next();
  };
}

export const requireUser: RequestHandler = (req, res, next) => {
  if (req.user) {
    next();
    return;
  }
  const body: ApiError = { error: { code: 'NOT_LOGGED_IN', message: 'Log in to continue.' } };
  res.status(401).json(body);
};

/**
 * Blocks "cross-site request forgery": another website making your browser
 * send a change to this one. Browsers say where a request came from (Origin);
 * changes must come from this same site.
 *
 * When something passes requests along (the Vite dev server, or a host's
 * proxy), the address the browser used arrives as X-Forwarded-Host instead of
 * Host, so a match with either is accepted. Another website can't add that
 * header to a browser's request without this server's permission (it never
 * gives any), so accepting it doesn't open a gap.
 */
export const sameOrigin: RequestHandler = (req, res, next) => {
  const origin = req.headers.origin;
  if (req.method === 'GET' || req.method === 'HEAD' || !origin) {
    next();
    return;
  }
  let originHost: string | null = null;
  try {
    originHost = new URL(origin).host;
  } catch {
    // not a valid address: treated as another site
  }
  const forwardedHost = req.headers['x-forwarded-host'];
  const siteHosts = [
    req.headers.host,
    ...(Array.isArray(forwardedHost) ? forwardedHost : [forwardedHost]),
  ];
  if (originHost && siteHosts.includes(originHost)) {
    next();
    return;
  }
  const body: ApiError = {
    error: { code: 'CROSS_SITE', message: 'Changes must come from this site.' },
  };
  res.status(403).json(body);
};

export function cookieOptions(secure: boolean): CookieOptions {
  return { httpOnly: true, sameSite: 'lax', secure, path: '/' };
}

export function setSessionCookie(res: Response, token: string, secure: boolean) {
  res.cookie(SESSION_COOKIE, token, {
    ...cookieOptions(secure),
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
  });
}

export function clearSessionCookie(res: Response, secure: boolean) {
  res.clearCookie(SESSION_COOKIE, cookieOptions(secure));
}

/** The logged-in person's id. Routes behind requireUser always have one. */
export function userIdOf(req: { user?: User | null }): number {
  if (!req.user) throw new AppError(401, 'NOT_LOGGED_IN', 'Log in to continue.');
  return req.user.id;
}
