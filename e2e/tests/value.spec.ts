// ============================================================================
// value.spec.ts: THE COLLECTION'S VALUE
//
// Kind of Blue is imported from the fake Discogs, which says its cheapest copy
// costs $24.99. A record added by hand has no Discogs link, so it has no price.
// ============================================================================

import { addRecord, expect, importKindOfBlue, test, unique } from './fixtures';

test('look up prices and see what the collection is worth', async ({ page }) => {
  await importKindOfBlue(page.request);
  await addRecord(page.request, unique('Hand-Added Album'));

  await page.goto('/');
  await page.getByRole('link', { name: 'Value', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'No prices yet' })).toBeVisible();

  await page.getByRole('button', { name: 'Update prices now' }).click();
  await expect(page.getByRole('main').getByRole('status')).toHaveText('Updated 1 price.');

  // The total is the one priced record; the hand-added one is explained, not counted.
  const main = page.getByRole('main');
  await expect(main.locator('.stat-tile').filter({ hasText: 'Collection value' })).toContainText(
    '$24.99',
  );
  await expect(main.locator('.stat-tile').filter({ hasText: 'Records priced' })).toContainText(
    '1 of 2',
  );
  const list = page.getByRole('region', { name: 'Records by value' });
  await expect(list.getByRole('listitem')).toHaveCount(1);
  await expect(list).toContainText('Kind Of Blue');
  await expect(main).toContainText("1 isn't linked to Discogs");
  // One day of prices isn't a history yet.
  await expect(main).toContainText('The chart appears once prices have been tracked');

  // Asking again straight away changes nothing: prices are looked up about once a day.
  await page.getByRole('button', { name: 'Update prices now' }).click();
  await expect(page.getByRole('main').getByRole('status')).toHaveText(
    'Prices are already up to date.',
  );
});
