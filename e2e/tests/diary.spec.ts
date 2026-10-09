// ============================================================================
// diary.spec.ts: LOGGING A PLAY, AND SEEING IT IN THE DIARY AND STATS
// ============================================================================

import { expect, importKindOfBlue, test, unique } from './fixtures';

test('log one side, see it in the diary and stats, then delete it', async ({ page, request }) => {
  const recordId = await importKindOfBlue(request);
  const note = unique('e2e play');

  await page.goto(`/records/${recordId}`);
  await expect(page.getByText('Not played yet.')).toBeVisible();

  // Log side A only. The button waits for the tracklist before it can be clicked.
  const logButton = page.getByRole('button', { name: '▶ Log a play' });
  await expect(logButton).toBeEnabled();
  await logButton.click();
  await page.getByRole('checkbox', { name: /Side B/ }).uncheck();
  await expect(page.getByLabel('Length')).toHaveValue('23:55');
  await page.getByRole('radio', { name: "I'm starting now" }).check();
  await page.getByLabel('Notes').fill(note);
  await page.getByRole('button', { name: 'Log play' }).click();

  await expect(page.getByText('Logged: Side A.')).toBeVisible();
  await expect(page.getByText(/^Played 1 time/)).toBeVisible();

  // The diary has it.
  await page.getByRole('link', { name: 'Diary', exact: true }).click();
  const entry = page.getByRole('listitem').filter({ hasText: note });
  await expect(entry).toContainText('Kind Of Blue');
  await expect(entry).toContainText('Side A · 23:55');

  // So do the stats.
  await page.getByRole('link', { name: 'Stats', exact: true }).click();
  await page.getByRole('button', { name: 'All time' }).click();
  await expect(page.getByRole('region', { name: 'Most-listened records' })).toContainText(
    'Kind Of Blue',
  );
  await expect(page.getByRole('region', { name: 'Most-listened artists' })).toContainText(
    'Miles Davis',
  );
  await page.getByRole('button', { name: 'Show as table' }).click();
  await expect(page.getByRole('table')).toContainText('Jazz');

  // Delete the play from the diary.
  await page.getByRole('link', { name: 'Diary', exact: true }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await entry.getByRole('button', { name: /Delete play/ }).click();
  await expect(entry).toHaveCount(0);
});
