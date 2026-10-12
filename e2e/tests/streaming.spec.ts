// ============================================================================
// streaming.spec.ts: STREAMING VS. SHELF AND THE WISHLIST
//
// Uses the fake Last.fm (support/fake-discogs.mjs), whose listener streamed
// In Rainbows, Kind of Blue (Legacy Edition) and Vespertine. The regular Kind
// of Blue is imported first, so the Legacy Edition shows as "a different edition".
// ============================================================================

import { expect, importKindOfBlue, test } from './fixtures';

test('compare streaming with the shelf, see a price, and use the wishlist', async ({ page }) => {
  await importKindOfBlue(page.request);

  await page.goto('/');
  await page.getByRole('link', { name: 'Streaming', exact: true }).click();
  await page.getByLabel('Last.fm username').fill('vinyl_fan');
  await page.getByRole('button', { name: 'Compare with my shelf' }).click();

  // Two streamed albums aren't on the shelf. The third is the Legacy Edition of an
  // album that's on the shelf in its regular edition, which doesn't count as owning it.
  await expect(
    page.getByText(
      'You own 0 of your 3 most-streamed albums on vinyl, and a different edition of 1 more.',
    ),
  ).toBeVisible();
  const missing = page.getByRole('region', { name: 'Not on your shelf' });
  const inRainbows = missing.getByRole('listitem').filter({ hasText: 'In Rainbows' });
  await expect(inRainbows).toContainText('Streamed 412 times');
  await expect(inRainbows).toContainText('From $24.99 on vinyl');
  const edition = page
    .getByRole('region', { name: 'You own a different edition' })
    .getByRole('listitem');
  await expect(edition).toContainText('Kind of Blue (Legacy Edition)');
  await expect(edition.getByRole('link', { name: 'Kind Of Blue', exact: true })).toBeVisible();
  await expect(edition.getByRole('button', { name: '+ Wishlist' })).toBeVisible();

  // Add it to the wishlist, and find it there.
  await inRainbows.getByRole('button', { name: '+ Wishlist' }).click();
  await expect(inRainbows.getByText('✓ On your wishlist')).toBeVisible();

  await page.getByRole('link', { name: 'Wishlist', exact: true }).first().click();
  const wished = page.getByRole('list', { name: 'Wishlist' }).getByRole('listitem');
  await expect(wished).toHaveCount(1);
  await expect(wished).toContainText('In Rainbows');
  await expect(wished).toContainText('Streamed 412 times when added');

  // It stays marked on the streaming page after a reload, and can be removed.
  await page.goto('/streaming');
  await expect(inRainbows.getByText('✓ On your wishlist')).toBeVisible();
  await page.goto('/wishlist');
  await page.getByRole('button', { name: 'Remove In Rainbows from the wishlist' }).click();
  await expect(page.getByRole('heading', { name: 'Your wishlist is empty' })).toBeVisible();
});
