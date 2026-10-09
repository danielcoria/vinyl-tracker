// ============================================================================
// production.test.ts: TESTS FOR THE ONLINE-ONLY PARTS
//
// The password lock, the server delivering the built website, and the
// security headers.
// ============================================================================

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { apiErrorSchema } from '@vinyl/shared';
import { createApp } from '../src/app.js';
import { createDb } from '../src/db/client.js';
import { passwordFromHeader, passwordLock } from '../src/middleware/password-lock.js';

const PASSWORD = 'correct horse battery';
const basic = (password: string, user = 'me') =>
  `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`;

function lockedApp() {
  return createApp({ db: createDb(':memory:'), password: PASSWORD });
}

describe('password lock', () => {
  it('asks for the password, which makes the browser show its password box', async () => {
    const res = await request(lockedApp()).get('/api/records');

    expect(res.status).toBe(401);
    expect(res.headers['www-authenticate']).toBe('Basic realm="Vinyl Tracker", charset="UTF-8"');
    expect(apiErrorSchema.parse(res.body).error.code).toBe('PASSWORD_REQUIRED');
  });

  it('lets the right password in, with any user name', async () => {
    const app = lockedApp();

    for (const user of ['me', 'anything', '']) {
      const res = await request(app)
        .get('/api/records')
        .set('Authorization', basic(PASSWORD, user));
      expect(res.status).toBe(200);
    }
  });

  it('turns away a wrong password', async () => {
    const res = await request(lockedApp())
      .get('/api/records')
      .set('Authorization', basic('wrong password'));

    expect(res.status).toBe(401);
  });

  it('keeps the health check open, so hosts can see the app is running', async () => {
    expect((await request(lockedApp()).get('/api/health')).status).toBe(200);
  });

  it('makes an address wait after 10 wrong passwords, even for the right one', async () => {
    const app = lockedApp();
    for (let i = 0; i < 10; i++) {
      await request(app)
        .get('/api/records')
        .set('Authorization', basic(`guess ${i}`));
    }

    const res = await request(app).get('/api/records').set('Authorization', basic(PASSWORD));

    expect(res.status).toBe(429);
    expect(res.headers['retry-after']).toBe('900');
    expect(apiErrorSchema.parse(res.body).error.code).toBe('TOO_MANY_ATTEMPTS');
  });

  it('lets the address try again after 15 minutes', async () => {
    let time = 0;
    const app = express();
    app.use(passwordLock(PASSWORD, () => time));
    app.get('/', (_req, res) => res.send('in'));
    for (let i = 0; i < 10; i++) {
      await request(app).get('/').set('Authorization', basic('nope'));
    }
    expect((await request(app).get('/').set('Authorization', basic(PASSWORD))).status).toBe(429);

    time += 15 * 60 * 1000;

    expect((await request(app).get('/').set('Authorization', basic(PASSWORD))).status).toBe(200);
  });

  it('reads the password out of the header', () => {
    expect(passwordFromHeader(basic('p:a:ss'))).toBe('p:a:ss'); // colons in passwords are fine
    expect(passwordFromHeader('Bearer abc')).toBeNull();
    expect(passwordFromHeader(undefined)).toBeNull();
  });

  it('is off when no password is set', async () => {
    const app = createApp({ db: createDb(':memory:') });
    expect((await request(app).get('/api/records')).status).toBe(200);
  });
});

describe('delivering the built website', () => {
  let dist: string;

  beforeAll(() => {
    // A tiny stand-in for client/dist.
    dist = mkdtempSync(path.join(tmpdir(), 'vinyl-dist-'));
    writeFileSync(path.join(dist, 'index.html'), '<!doctype html><title>Vinyl Tracker</title>');
    mkdirSync(path.join(dist, 'assets'));
    writeFileSync(path.join(dist, 'assets', 'index-abc123.js'), 'console.log("app")');
  });

  afterAll(() => rmSync(dist, { recursive: true, force: true }));

  const app = () => createApp({ db: createDb(':memory:'), clientDist: dist });

  it('sends the app for the home page and for any page address', async () => {
    for (const address of ['/', '/records/5', '/stats?period=all']) {
      const res = await request(app()).get(address);
      expect(res.status).toBe(200);
      expect(res.text).toContain('<title>Vinyl Tracker</title>');
      expect(res.headers['cache-control']).toBe('no-cache');
    }
  });

  it('lets browsers keep the asset files for a year', async () => {
    const res = await request(app()).get('/assets/index-abc123.js');

    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('public, max-age=31536000, immutable');
  });

  it('still answers unknown /api addresses with a JSON 404, not the app', async () => {
    const res = await request(app()).get('/api/nope');

    expect(res.status).toBe(404);
    expect(apiErrorSchema.parse(res.body).error.code).toBe('NOT_FOUND');
  });

  it('puts the website behind the password too', async () => {
    const locked = createApp({ db: createDb(':memory:'), clientDist: dist, password: PASSWORD });

    expect((await request(locked).get('/')).status).toBe(401);
    expect((await request(locked).get('/').set('Authorization', basic(PASSWORD))).status).toBe(200);
  });
});

describe('security headers', () => {
  it('limits what the browser will load and run', async () => {
    const res = await request(createApp({ db: createDb(':memory:') })).get('/api/health');

    const csp = res.headers['content-security-policy'];
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain('img-src');
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain('upgrade-insecure-requests');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
