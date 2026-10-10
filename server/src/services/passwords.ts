// ============================================================================
// passwords.ts (service): STORING PASSWORDS SAFELY
//
// Passwords are never stored. Instead we store a "hash": the result of running
// the password through scrypt, a scrambling method designed to be slow and to
// use lots of memory, so guessing millions of passwords is impractical even for
// someone with a copy of the database. Each password gets its own random "salt",
// so two people with the same password still get different hashes.
//
// Stored as: scrypt$<N>$<r>$<p>$<salt>$<hash>   (the settings travel with the
// hash, so they can be made stronger later without breaking old passwords)
// ============================================================================

import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

const KEY_LENGTH = 64;
// Cost settings: N = how much work, r = memory per step, p = parallel steps.
const DEFAULTS = { N: 2 ** 15, r: 8, p: 1 };

function derive(password: string, salt: Buffer, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // maxmem must be raised for these settings (they need about 32 MB).
    scrypt(password, salt, KEY_LENGTH, { ...options, maxmem: 64 * 1024 * 1024 }, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, DEFAULTS);
  const { N, r, p } = DEFAULTS;
  return ['scrypt', N, r, p, salt.toString('base64'), key.toString('base64')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, N, r, p, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !N || !r || !p || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const key = await derive(password, Buffer.from(salt, 'base64'), {
    N: Number(N),
    r: Number(r),
    p: Number(p),
  });
  // Compare in constant time, so the time taken doesn't hint at how close a guess was.
  return key.length === expected.length && timingSafeEqual(key, expected);
}
