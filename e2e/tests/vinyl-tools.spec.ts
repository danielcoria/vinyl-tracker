// ============================================================================
// vinyl-tools.spec.ts: THE DUST REPORT AND THE STYLUS WARNING
// ============================================================================

import { addRecord, expect, test, unique } from './fixtures';

test.describe('dust report', () => {
  test.afterEach(async ({ request }) => {
    // The threshold is shared by every test, so put it back.
    await request.put('/api/settings', { data: { dustThresholdDays: 90 } });
  });

  test('lists never-played records, remembers the threshold, and picks one', async ({
    page,
    request,
  }) => {
    const title = unique('Never Played');
    await addRecord(request, title);

    await page.goto('/dust');
    await expect(page.getByRole('region', { name: /Never played/ })).toContainText(title);

    // Change the threshold; it's still set after a reload.
    await page.getByLabel('Days without a play').selectOption({ label: '1 year' });
    await page.reload();
    await expect(page.getByLabel('Days without a play')).toHaveValue('365');

    await page.getByRole('button', { name: /Pick one for me/ }).click();
    await expect(page).toHaveURL(/\/records\/\d+$/);
  });
});

test.describe('stylus', () => {
  let stylusId: number | null = null;

  test.afterEach(async ({ request }) => {
    // Removing it puts back whatever stylus was in use before (if any).
    if (stylusId !== null) await request.delete(`/api/styluses/${stylusId}`);
  });

  test('warns when the stylus is worn, and × hides it for this visit', async ({
    page,
    browser,
    baseURL,
  }) => {
    const name = unique('E2E Stylus');
    await page.goto('/stylus');

    // The heading appears once the page has loaded (so we know if a stylus exists).
    await expect(page.getByRole('heading', { level: 1, name: 'Stylus' })).toBeVisible();

    // Install one that is already at 90% of its rating.
    const installAnother = page.getByRole('button', { name: 'Install a new stylus' });
    if (await installAnother.isVisible()) await installAnother.click();
    await page.getByLabel('Stylus', { exact: true }).fill(name);
    await page.getByLabel('Rated hours').fill('100');
    await page.getByLabel('Hours already on it').fill('90');
    const saved = page.waitForResponse(
      (res) => res.url().endsWith('/api/styluses') && res.request().method() === 'POST',
    );
    await page.getByRole('button', { name: /^(Add stylus|Install new stylus)$/ }).click();
    stylusId = ((await (await saved).json()) as { id: number }).id;

    const current = page.getByRole('region', { name: 'Stylus in use' });
    await expect(current).toContainText(name);
    await expect(current).toContainText('⚠ Replace soon');
    await expect(current.getByRole('meter', { name: 'Stylus wear' })).toHaveAttribute(
      'aria-valuenow',
      '90',
    );

    // Every other page shows the warning...
    await page.getByRole('link', { name: 'Collection', exact: true }).click();
    const warning = page.getByText('Your stylus has used 90% of its rated hours.', {
      exact: false,
    });
    await expect(warning).toBeVisible();

    // ...until × is clicked, and it stays hidden after a reload.
    await page.getByRole('button', { name: 'Hide this warning' }).click();
    await expect(warning).toBeHidden();
    await page.reload();
    await expect(page.getByText('Server: ok')).toBeVisible();
    await expect(warning).toBeHidden();

    // Opening the site fresh (a new browser window) shows it again.
    const fresh = await browser.newPage({ baseURL });
    await fresh.goto('/');
    await expect(
      fresh.getByText('Your stylus has used 90% of its rated hours.', { exact: false }),
    ).toBeVisible();
    await fresh.close();
  });
});
