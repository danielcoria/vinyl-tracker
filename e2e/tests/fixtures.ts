// ============================================================================
// fixtures.ts: SHARED SETUP AND SHORTCUTS FOR THE END-TO-END TESTS
//
//   test, expect      Playwright's, plus: Discogs cover images are answered with
//                     a plain gray square, so tests never download real images
//   unique(name)      a name no other test (or earlier run) has used
//   KIND_OF_BLUE      the release the fake Discogs knows about
//   importKindOfBlue  add it to the collection through the API (fast setup)
//   removeKindOfBlue  take it out again, so a test can start from scratch
// ============================================================================

import { test as base, expect, type APIRequestContext } from '@playwright/test';

const GRAY_SQUARE =
  '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="#999"/></svg>';

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route(/^https:\/\/(i|st)\.discogs\.com\//, (route) =>
      route.fulfill({ status: 200, contentType: 'image/svg+xml', body: GRAY_SQUARE }),
    );
    await use(page);
  },
});

export { expect };

export function unique(name: string): string {
  return `${name} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

export const KIND_OF_BLUE = 2772432;

/** The record id of Kind of Blue in the collection, or null if it isn't there. */
async function findKindOfBlue(request: APIRequestContext): Promise<number | null> {
  const res = await request.get('/api/discogs/search?q=kind+of+blue');
  expect(res.ok()).toBe(true);
  const { results } = (await res.json()) as {
    results: { releaseId: number; inCollectionId: number | null }[];
  };
  return results.find((r) => r.releaseId === KIND_OF_BLUE)?.inCollectionId ?? null;
}

export async function removeKindOfBlue(request: APIRequestContext) {
  const id = await findKindOfBlue(request);
  if (id !== null) expect((await request.delete(`/api/records/${id}`)).status()).toBe(204);
}

export async function importKindOfBlue(request: APIRequestContext): Promise<number> {
  await removeKindOfBlue(request);
  const res = await request.post('/api/discogs/import', { data: { releaseId: KIND_OF_BLUE } });
  expect(res.status()).toBe(201);
  return ((await res.json()) as { id: number }).id;
}

/** Adds a record through the API and returns its id. */
export async function addRecord(request: APIRequestContext, title: string): Promise<number> {
  const res = await request.post('/api/records', {
    data: { title, artists: ['E2E Artist'], runtimeSeconds: 2400, genres: ['Jazz'] },
  });
  expect(res.status()).toBe(201);
  return ((await res.json()) as { id: number }).id;
}
