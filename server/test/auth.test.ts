// ============================================================================
// auth.test.ts: TESTS FOR ACCOUNTS AND LOGGING IN
//
// request.agent(app) acts like one browser: it keeps the login cookie between
// requests, just as a real browser would.
// ============================================================================

import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { apiErrorSchema, meResponseSchema } from '@vinyl/shared';
import { createApp } from '../src/app.js';
import { createDb } from '../src/db/client.js';
import { sessions, users } from '../src/db/schema.js';
import { hashPassword, verifyPassword } from '../src/services/passwords.js';
import { startSession, userForSession } from '../src/services/auth.js';

const PASSWORD = 'spin the black circle';

function setup() {
  const db = createDb(':memory:');
  return { db, app: createApp({ db }) };
}

const errorOf = (body: unknown) => apiErrorSchema.parse(body).error;
const me = async (agent: ReturnType<typeof request.agent>) =>
  meResponseSchema.parse((await agent.get('/api/auth/me')).body).user;

describe('passwords', () => {
  it('are stored as a salted hash that only the right password matches', async () => {
    const hash = await hashPassword(PASSWORD);

    expect(hash).not.toContain(PASSWORD);
    expect(hash).toMatch(/^scrypt\$32768\$8\$1\$/);
    expect(await verifyPassword(PASSWORD, hash)).toBe(true);
    expect(await verifyPassword('spin the black circle!', hash)).toBe(false);
    // The same password twice gives different hashes (different salts).
    expect(await hashPassword(PASSWORD)).not.toBe(hash);
  });

  it('rejects stored values that are not hashes', async () => {
    expect(await verifyPassword(PASSWORD, 'plain-text')).toBe(false);
  });
});

describe('signing up', () => {
  it('creates the account and logs in', async () => {
    const { app, db } = setup();
    const browser = request.agent(app);

    const res = await browser
      .post('/api/auth/signup')
      .send({ username: '  Daniel_C ', password: PASSWORD, displayName: 'Daniel' });

    expect(res.status).toBe(201);
    expect(meResponseSchema.parse(res.body).user).toMatchObject({
      username: 'daniel_c', // trimmed and lowercased
      displayName: 'Daniel',
    });
    expect(res.body.user).not.toHaveProperty('passwordHash');
    expect((await me(browser))?.username).toBe('daniel_c');
    // The password itself is nowhere in the database.
    const [row] = db.select().from(users).all();
    expect(row?.passwordHash).not.toContain(PASSWORD);
  });

  it('sets a cookie the page cannot read and other sites cannot send', async () => {
    const res = await request(setup().app)
      .post('/api/auth/signup')
      .send({ username: 'daniel', password: PASSWORD });

    const cookie = res.headers['set-cookie']?.[0] ?? '';
    expect(cookie).toMatch(/^vt_session=[\w-]{40,};/);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Max-Age=2592000'); // 30 days
  });

  it('marks the cookie Secure online', async () => {
    const app = createApp({ db: createDb(':memory:'), secureCookies: true });

    const res = await request(app)
      .post('/api/auth/signup')
      .send({ username: 'daniel', password: PASSWORD });

    expect(res.headers['set-cookie']?.[0]).toContain('Secure');
  });

  it('uses the username as the display name when none is given', async () => {
    const res = await request(setup().app)
      .post('/api/auth/signup')
      .send({ username: 'daniel', password: PASSWORD });

    expect(res.body.user.displayName).toBe('daniel');
  });

  it("won't reuse a username, ignoring capital letters", async () => {
    const { app } = setup();
    await request(app).post('/api/auth/signup').send({ username: 'daniel', password: PASSWORD });

    const res = await request(app)
      .post('/api/auth/signup')
      .send({ username: 'DANIEL', password: PASSWORD });

    expect(res.status).toBe(409);
    expect(errorOf(res.body)).toEqual({
      code: 'USERNAME_TAKEN',
      message: 'That username is taken. Try another one.',
    });
  });

  it('explains bad usernames and short passwords', async () => {
    const res = await request(setup().app)
      .post('/api/auth/signup')
      .send({ username: 'no spaces!', password: 'short' });

    expect(res.status).toBe(400);
    const { message } = errorOf(res.body);
    expect(message).toContain('username: Use only letters, numbers and _');
    expect(message).toContain('password: Use at least 8 characters');
  });
});

describe('logging in and out', () => {
  async function withAccount() {
    const ctx = setup();
    await request(ctx.app)
      .post('/api/auth/signup')
      .send({ username: 'daniel', password: PASSWORD });
    return ctx;
  }

  it('logs in with the right password, ignoring capitals in the username', async () => {
    const { app } = await withAccount();
    const browser = request.agent(app);

    const res = await browser
      .post('/api/auth/login')
      .send({ username: 'Daniel', password: PASSWORD });

    expect(res.status).toBe(200);
    expect((await me(browser))?.username).toBe('daniel');
  });

  it('gives the same answer for a wrong password and an unknown username', async () => {
    const { app } = await withAccount();

    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ username: 'daniel', password: 'not it at all' });
    const unknownUser = await request(app)
      .post('/api/auth/login')
      .send({ username: 'nobody', password: PASSWORD });

    for (const res of [wrongPassword, unknownUser]) {
      expect(res.status).toBe(401);
      expect(errorOf(res.body)).toEqual({
        code: 'INVALID_LOGIN',
        message: 'Wrong username or password.',
      });
    }
  });

  it('pauses logging in after 10 wrong passwords', async () => {
    const { app } = await withAccount();
    for (let i = 0; i < 10; i++) {
      await request(app)
        .post('/api/auth/login')
        .send({ username: 'daniel', password: `guess ${i}` });
    }

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'daniel', password: PASSWORD });

    expect(res.status).toBe(429);
    expect(errorOf(res.body).code).toBe('TOO_MANY_ATTEMPTS');
  });

  it('logs out, and the old cookie stops working', async () => {
    const { app } = await withAccount();
    const browser = request.agent(app);
    const login = await browser
      .post('/api/auth/login')
      .send({ username: 'daniel', password: PASSWORD });
    // Keep a copy of the login cookie ("vt_session=..."), as an attacker might.
    const cookie = login.headers['set-cookie']?.[0]?.split(';')[0] ?? '';
    expect(cookie).toMatch(/^vt_session=/);
    const before = await request(app).get('/api/auth/me').set('Cookie', cookie);
    expect(before.body.user?.username).toBe('daniel');

    const res = await browser.post('/api/auth/logout');

    expect(res.status).toBe(204);
    expect(await me(browser)).toBeNull();
    // The saved copy of the old cookie no longer logs anyone in.
    const replay = await request(app).get('/api/auth/me').set('Cookie', cookie);
    expect(replay.body.user).toBeNull();
  });

  it('says nobody is logged in without a cookie, or with a made-up one', async () => {
    const { app } = setup();

    expect((await request(app).get('/api/auth/me')).body).toEqual({ user: null });
    const fake = await request(app).get('/api/auth/me').set('Cookie', 'vt_session=made-up-token');
    expect(fake.body).toEqual({ user: null });
  });
});

describe('sessions', () => {
  it('stores only a hash of the token, and expire after 30 days', async () => {
    const { db, app } = setup();
    await request(app).post('/api/auth/signup').send({ username: 'daniel', password: PASSWORD });
    const userId = db.select().from(users).get()?.id ?? 0;
    const start = Date.parse('2026-10-10T12:00:00.000Z');

    const { token } = startSession(db, userId, start);

    expect(
      db
        .select()
        .from(sessions)
        .all()
        .some((s) => s.id === token),
    ).toBe(false);
    expect(userForSession(db, token, start + 29 * 24 * 3600_000)?.username).toBe('daniel');
    expect(userForSession(db, token, start + 31 * 24 * 3600_000)).toBeNull();
  });
});

describe('requests from other websites', () => {
  it('are refused when they try to change something', async () => {
    const res = await request(setup().app)
      .post('/api/auth/signup')
      .set('Origin', 'https://evil.example')
      .send({ username: 'daniel', password: PASSWORD });

    expect(res.status).toBe(403);
    expect(errorOf(res.body).code).toBe('CROSS_SITE');
  });

  it('are fine from this same site', async () => {
    const res = await request(setup().app)
      .post('/api/auth/signup')
      .set('Host', 'vinyl.example')
      .set('Origin', 'https://vinyl.example')
      .send({ username: 'daniel', password: PASSWORD });

    expect(res.status).toBe(201);
  });
});

describe('requests passed along by a proxy (like the Vite dev server)', () => {
  it('are accepted when the forwarded address matches where they came from', async () => {
    const res = await request(setup().app)
      .post('/api/auth/signup')
      .set('Host', 'localhost:3001')
      .set('X-Forwarded-Host', 'localhost:5173')
      .set('Origin', 'http://localhost:5173')
      .send({ username: 'daniel', password: PASSWORD });

    expect(res.status).toBe(201);
  });

  it('are still refused when neither address matches', async () => {
    const res = await request(setup().app)
      .post('/api/auth/signup')
      .set('Host', 'localhost:3001')
      .set('X-Forwarded-Host', 'localhost:5173')
      .set('Origin', 'https://evil.example')
      .send({ username: 'daniel', password: PASSWORD });

    expect(res.status).toBe(403);
  });
});
