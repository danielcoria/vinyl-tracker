// ============================================================================
// profile.spec.ts: MAKING A PROFILE PUBLIC AND SEEING IT AS A VISITOR
//
// The owner opens their profile from the header, turns it public, and a
// visitor in a separate browser (not logged in) sees it and its year recap.
// Turning it private again hides it from the visitor.
// ============================================================================

import { addRecord, expect, test, unique } from './fixtures';

test('make a profile public, share it, and see it as a visitor', async ({
  page,
  account,
  browser,
  baseURL,
}) => {
  const title = unique('Profile Album');
  const recordId = await addRecord(page.request, title);
  const res = await page.request.post('/api/spins', {
    data: { recordId, durationSeconds: 2400 },
  });
  expect(res.status()).toBe(201);

  // The owner finds their profile through their name in the header.
  await page.goto('/');
  // (No display name was given at sign-up, so the name shown is the username.)
  await page.getByRole('banner').getByRole('link', { name: account.username, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/u/${account.username}$`));
  await expect(page.getByText('Only you can see this page.', { exact: false })).toBeVisible();

  // A visitor can't see it yet.
  const visitor = await browser.newPage({ baseURL });
  await visitor.goto(`/u/${account.username}`);
  await expect(visitor.getByRole('heading', { name: 'No profile here' })).toBeVisible();

  // Make it public.
  // (click + wait, rather than check(): the switch updates a moment after the click.)
  const publicSwitch = page.getByRole('checkbox', { name: 'Public profile' });
  await publicSwitch.click();
  await expect(publicSwitch).toBeChecked();
  await expect(page.getByText('Anyone with the link can see this page.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Share profile' })).toBeVisible();

  // Now the visitor sees the shelf and the most-played record, without logging in.
  await visitor.reload();
  await expect(visitor.getByRole('region', { name: 'Shelf' })).toContainText(title);
  await expect(visitor.getByRole('region', { name: 'Most-played records' })).toContainText(title);
  await expect(visitor.getByRole('link', { name: 'Log in' })).toBeVisible();

  // And this year's recap.
  const year = new Date().getFullYear();
  await visitor
    .getByRole('navigation', { name: 'Year in records' })
    .getByRole('link', { name: String(year) })
    .click();
  await expect(visitor.getByRole('heading', { name: `${year} in records` })).toBeVisible();
  await expect(visitor.getByText('Record of the year')).toBeVisible();
  await expect(visitor.getByRole('heading', { name: title })).toBeVisible();

  // Private again: the visitor is turned away.
  await publicSwitch.click();
  await expect(publicSwitch).not.toBeChecked();
  await expect(page.getByText('Only you can see this page.', { exact: false })).toBeVisible();
  await visitor.goto(`/u/${account.username}`);
  await expect(visitor.getByRole('heading', { name: 'No profile here' })).toBeVisible();

  await visitor.close();
});
