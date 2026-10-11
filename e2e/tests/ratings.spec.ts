// ============================================================================
// ratings.spec.ts: RATING AND REVIEWING A RECORD, AND SEEING IT ON THE PROFILE
// ============================================================================

import { addRecord, expect, test, unique } from './fixtures';

test('rate and review a record, then see it in the collection and on the profile', async ({
  page,
  account,
}) => {
  const title = unique('Rated Album');
  const recordId = await addRecord(page.request, title);

  // Click the left half of the fifth star: 4.5 stars. It saves straight away.
  await page.goto(`/records/${recordId}`);
  const stars = page.getByRole('radiogroup', { name: 'Your rating' });
  await stars.getByTitle('4.5 stars').click();
  await expect(stars.getByRole('radio', { name: '4.5 stars' })).toBeChecked();

  // Write a review.
  await page.getByRole('button', { name: 'Write a review' }).click();
  await page.getByRole('textbox', { name: 'Review' }).fill('Sounds great on a rainy day.');
  await page.getByRole('button', { name: 'Save review' }).click();
  await expect(page.getByRole('button', { name: 'Edit review' })).toBeVisible();

  // Both are still there after a reload.
  await page.reload();
  await expect(
    page.getByRole('radiogroup', { name: 'Your rating' }).getByRole('radio', { name: '4.5 stars' }),
  ).toBeChecked();
  await expect(page.getByText('Sounds great on a rainy day.')).toBeVisible();

  // The collection shows the stars and can sort by them.
  await page.getByRole('link', { name: 'Collection', exact: true }).click();
  await page.getByLabel('Sort by').selectOption({ label: 'Highest rated' });
  await expect(page).toHaveURL(/sort=rating/);
  await expect(
    page.getByRole('link', { name: new RegExp(title) }).getByRole('img', { name: '4.5 stars' }),
  ).toBeVisible();

  // And the profile shows the rating and the review.
  await page.goto(`/u/${account.username}`);
  await expect(page.getByRole('region', { name: 'Highest rated' })).toContainText(title);
  await expect(page.getByRole('region', { name: 'Reviews' })).toContainText(
    'Sounds great on a rainy day.',
  );
});
