// ============================================================================
// discogs.spec.ts: IMPORTING A RECORD FROM DISCOGS
//
// Uses the fake Discogs (support/fake-discogs.mjs), which knows "Kind of Blue".
// Each test has its own new account, so its collection starts empty.
// ============================================================================

import { expect, test } from './fixtures';

test('search Discogs, add a pressing, and open it with its tracklist', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Add from Discogs', exact: true }).first().click();
  await page.getByRole('searchbox', { name: 'Search Discogs' }).fill('kind of blue');
  await page.getByRole('button', { name: 'Search', exact: true }).click();

  // The first result is the 2010 French reissue, Columbia CS 8163.
  const pressing = page.locator('.discogs-result').first();
  await expect(pressing).toContainText('Kind Of Blue');
  await expect(pressing).toContainText('2010 · LP · France');
  await expect(pressing).toContainText('Columbia · CS 8163');

  await pressing.getByRole('button', { name: 'Add to collection' }).click();
  await expect(page.getByText('Added “Kind Of Blue” to your collection.')).toBeVisible();

  // The button turns into a link to the new record.
  await pressing.getByRole('link', { name: 'In your collection →' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Kind Of Blue');
  await expect(page.getByText('Columbia · CS 8163')).toBeVisible();
  await expect(page.getByText('45:01')).toBeVisible(); // added up from the tracklist
  await expect(page.getByRole('region', { name: 'Side A' })).toContainText('So What');
  await expect(page.getByRole('region', { name: 'Side B' })).toContainText('Flamenco Sketches');
  await expect(page.getByRole('link', { name: 'View on Discogs ↗' })).toHaveAttribute(
    'href',
    'https://www.discogs.com/release/2772432',
  );
});
