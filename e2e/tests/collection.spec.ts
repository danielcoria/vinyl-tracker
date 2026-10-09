// ============================================================================
// collection.spec.ts: ADDING, FINDING, EDITING AND DELETING A RECORD BY HAND
// ============================================================================

import { expect, test, unique } from './fixtures';

test('add a record by hand, find it, edit it and delete it', async ({ page }) => {
  const title = unique('Hand-Added Album');

  // Add it. Wait for the collection to load first: an empty collection shows a
  // second "Add manually" link in its "Your shelf is empty" box, so the test
  // uses the one at the top of the page, which is always there.
  await page.goto('/');
  await expect(page.getByText('Loading your records…')).toBeHidden();
  await page.locator('.page-header').getByRole('link', { name: 'Add manually' }).click();
  await page.getByLabel('Title').fill(title);
  await page.getByLabel('Artist 1').fill('E2E Artist');
  await page.getByLabel('Year').fill('1999');
  await page.getByLabel('Length').fill('41:30');
  await page.getByLabel('Genres').fill('Jazz');
  await page.getByLabel('Genres').press('Enter');
  await page.getByLabel('Media condition').selectOption({ label: 'VG+ (Very Good Plus)' });
  await page.getByRole('button', { name: 'Add record' }).click();

  // It opens on its own page.
  await expect(page).toHaveURL(/\/records\/\d+$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
  await expect(page.getByText('41:30')).toBeVisible();
  await expect(page.getByText('VG+ (Very Good Plus)')).toBeVisible();

  // Find it with the search box.
  await page.getByRole('link', { name: 'Collection', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Search records' }).fill(title);
  await expect(page).toHaveURL(/\?q=/);
  await page.getByRole('link', { name: title }).click();

  // Edit it.
  await page.getByRole('link', { name: 'Edit', exact: true }).click();
  await page.getByLabel('Title').fill(`${title} (Remastered)`);
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`${title} (Remastered)`);

  // Delete it (accepting the "are you sure?" box).
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole('searchbox', { name: 'Search records' }).fill(title);
  await expect(page.getByText(`No records match “${title}”.`)).toBeVisible();
});

test('the form explains mistakes instead of saving', async ({ page }) => {
  await page.goto('/records/new');
  await page.getByLabel('Length').fill('forty minutes');
  await page.getByRole('button', { name: 'Add record' }).click();

  await expect(page.getByText('Please fix the highlighted fields.')).toBeVisible();
  await expect(page.getByText('Title is required')).toBeVisible();
  await expect(page.getByText('Use minutes:seconds, like 42:49')).toBeVisible();
  await expect(page).toHaveURL(/\/records\/new$/);
});
