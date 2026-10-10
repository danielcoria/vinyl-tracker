// ============================================================================
// auth.spec.ts: SIGNING UP, LOGGING OUT AND LOGGING IN, IN A REAL BROWSER
// ============================================================================

import { expect, guestTest as test, PASSWORD, uniqueUsername } from './fixtures';

test('sign up, log out, and log back in, landing where you meant to go', async ({ page }) => {
  const username = uniqueUsername();

  // Logged out: a page sends you to log in first.
  await page.goto('/stats');
  await expect(page).toHaveURL(/\/login\?next=%2Fstats$/);
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeHidden();

  // Create an account; you land on the page you were going to.
  await page.getByRole('link', { name: 'Create an account' }).click();
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Display name (optional)').fill('E2E Listener');
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/stats$/);
  await expect(page.getByText('E2E Listener')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'No plays in this period' })).toBeVisible();

  // Log out.
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);

  // A wrong password is explained.
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password').fill('not the password');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByRole('alert')).toHaveText('Wrong username or password.');

  // The right one gets you back in, and the login survives a reload.
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByRole('heading', { name: 'Your collection' })).toBeVisible();
  await page.reload();
  await expect(page.getByText('E2E Listener')).toBeVisible();
});

test("two accounts don't see each other's records", async ({ browser, baseURL }) => {
  const title = `Private ${Date.now()}`;

  const alex = await browser.newPage({ baseURL });
  await alex.request.post('/api/auth/signup', {
    data: { username: uniqueUsername(), password: PASSWORD },
  });
  await alex.request.post('/api/records', { data: { title, artists: ['Alex'] } });
  await alex.goto('/');
  await expect(alex.getByRole('link', { name: title })).toBeVisible();

  const blair = await browser.newPage({ baseURL });
  await blair.request.post('/api/auth/signup', {
    data: { username: uniqueUsername(), password: PASSWORD },
  });
  await blair.goto('/');
  await expect(blair.getByRole('heading', { name: 'Your shelf is empty' })).toBeVisible();
  await expect(blair.getByText(title)).toHaveCount(0);

  await alex.close();
  await blair.close();
});
