// ============================================================================
// fixtures.ts: SHARED SETUP AND SHORTCUTS FOR THE END-TO-END TESTS
//
//   test              every test signs up its OWN brand-new account first, so
//                     tests never see each other's records, plays or stylus
//   guestTest         a test that starts logged out (for testing logging in)
//   expect            Playwright's
//   unique(name)      a name no other test (or earlier run) has used
//   uniqueUsername()  the same, but a valid username
//   importKindOfBlue  add the album the fake Discogs knows about (fast setup)
//   addRecord         add a record through the API (fast setup)
//
// Discogs cover images are answered with a plain gray square, so tests never
// download real images. Setup shortcuts use `page.request`, which shares the
// page's login cookie.
// ============================================================================

import { test as base, expect, type APIRequestContext } from '@playwright/test';

const GRAY_SQUARE =
  '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="#999"/></svg>';

export const PASSWORD = 'e2e-password-123';

export function unique(name: string): string {
  return `${name} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

export function uniqueUsername(): string {
  return `e2e_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Starts logged out. Discogs images are stubbed. */
export const guestTest = base.extend({
  page: async ({ page }, use) => {
    await page.route(/^https:\/\/(i|st)\.discogs\.com\//, (route) =>
      route.fulfill({ status: 200, contentType: 'image/svg+xml', body: GRAY_SQUARE }),
    );
    await use(page);
  },
});

/** Starts logged in to a brand-new account of its own. */
export const test = guestTest.extend<{ account: { username: string } }>({
  account: [
    async ({ page }, use) => {
      const username = uniqueUsername();
      const res = await page.request.post('/api/auth/signup', {
        data: { username, password: PASSWORD },
      });
      expect(res.status()).toBe(201);
      await use({ username });
    },
    // "auto": runs for every test, even ones that don't mention `account`.
    { auto: true },
  ],
});

export { expect };

export const KIND_OF_BLUE = 2772432;

export async function importKindOfBlue(api: APIRequestContext): Promise<number> {
  const res = await api.post('/api/discogs/import', { data: { releaseId: KIND_OF_BLUE } });
  expect(res.status()).toBe(201);
  return ((await res.json()) as { id: number }).id;
}

/** Adds a record through the API and returns its id. */
export async function addRecord(api: APIRequestContext, title: string): Promise<number> {
  const res = await api.post('/api/records', {
    data: { title, artists: ['E2E Artist'], runtimeSeconds: 2400, genres: ['Jazz'] },
  });
  expect(res.status()).toBe(201);
  return ((await res.json()) as { id: number }).id;
}
