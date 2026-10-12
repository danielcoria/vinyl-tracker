// ============================================================================
// discover.spec.ts: RECOMMENDATIONS BASED ON THE SHELF
//
// Uses the fake Last.fm (support/fake-discogs.mjs): whoever it's asked about,
// it answers with the artists similar to Miles Davis and with John Coltrane's
// albums. With Kind of Blue on the shelf, that's enough to get suggestions.
// ============================================================================

import { expect, importKindOfBlue, test } from './fixtures';

test('get recommendations from the shelf and add one to the wishlist', async ({ page }) => {
  await importKindOfBlue(page.request);

  await page.goto('/');
  await page.getByRole('link', { name: 'Discover', exact: true }).click();

  const list = page.getByRole('list', { name: 'Recommendations' });
  const first = list.getByRole('listitem').first();
  // John Coltrane is the artist most similar to Miles Davis; Blue Train is his best-known album.
  await expect(first).toContainText('Blue Train');
  await expect(first).toContainText('John Coltrane');
  await expect(first).toContainText('Because you own Miles Davis');
  await expect(first).toContainText('From $24.99 on vinyl');
  // "Miles Davis Quintet" is similar too, but it's Miles Davis again, so it's left out.
  await expect(list).not.toContainText('Miles Davis Quintet');
  // At most two suggestions for the same reason.
  await expect(list.getByRole('listitem')).toHaveCount(2);

  await first.getByRole('button', { name: '+ Wishlist' }).click();
  await expect(first.getByText('✓ On your wishlist')).toBeVisible();

  await page.getByRole('link', { name: 'Wishlist', exact: true }).first().click();
  await expect(page.getByRole('list', { name: 'Wishlist' })).toContainText('Blue Train');
});
