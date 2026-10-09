// ============================================================================
// password-lock.ts: ONE SHARED PASSWORD FOR THE WHOLE SITE
//
// Until accounts arrive (M11), an online copy is protected by one password
// (APP_PASSWORD). It uses "Basic Auth": the browser's own password box pops up,
// and the browser then sends the password with every request.
//
//   - Any user name is accepted; only the password matters.
//   - After 10 wrong passwords from the same address within 15 minutes, that
//     address must wait (so nobody can guess forever).
//   - Passwords are compared in a way that takes the same time whether they're
//     close or not, so the timing doesn't give hints.
// Use it only over HTTPS (the padlock), or the password travels unprotected.
// ============================================================================

import { createHash, timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import type { ApiError } from '@vinyl/shared';

const MAX_FAILURES = 10;
const WINDOW_MS = 15 * 60 * 1000;

const hash = (text: string) => createHash('sha256').update(text, 'utf8').digest();

/** The password from an "Authorization: Basic <base64 of user:password>" header. */
export function passwordFromHeader(header: string | undefined): string | null {
  const match = header?.match(/^Basic\s+(.+)$/i);
  if (!match?.[1]) return null;
  const decoded = Buffer.from(match[1], 'base64').toString('utf8');
  const colon = decoded.indexOf(':');
  return colon === -1 ? null : decoded.slice(colon + 1);
}

export function passwordLock(
  password: string,
  /** The clock. Tests pass a fake one to skip the 15-minute wait. */
  now: () => number = Date.now,
): RequestHandler {
  const expected = hash(password);
  // address -> times of recent wrong passwords
  const failures = new Map<string, number[]>();

  return (req, res, next) => {
    const address = req.ip ?? 'unknown';
    const recent = (failures.get(address) ?? []).filter((time) => now() - time < WINDOW_MS);

    if (recent.length >= MAX_FAILURES) {
      const body: ApiError = {
        error: {
          code: 'TOO_MANY_ATTEMPTS',
          message: 'Too many wrong passwords. Try again in 15 minutes.',
        },
      };
      res
        .status(429)
        .set('Retry-After', String(WINDOW_MS / 1000))
        .json(body);
      return;
    }

    const given = passwordFromHeader(req.headers.authorization);
    if (given !== null && timingSafeEqual(hash(given), expected)) {
      failures.delete(address);
      next();
      return;
    }

    if (given !== null) {
      recent.push(now());
      failures.set(address, recent);
      forgetOldFailures(failures, now());
    }

    // This header is what makes the browser show its password box.
    res.status(401).set('WWW-Authenticate', 'Basic realm="Vinyl Tracker", charset="UTF-8"');
    const body: ApiError = {
      error: { code: 'PASSWORD_REQUIRED', message: 'Enter the password to use Vinyl Tracker.' },
    };
    res.json(body);
  };
}

/** Keeps the list of addresses from growing forever. */
function forgetOldFailures(failures: Map<string, number[]>, now: number) {
  if (failures.size < 1000) return;
  for (const [address, times] of failures) {
    if (times.every((time) => now - time >= WINDOW_MS)) failures.delete(address);
  }
}
