// ============================================================================
// tonight.spec.ts: "WHAT SHOULD I PLAY TONIGHT?" IN A REAL BROWSER
//
// Two 40-minute records on the shelf: asking with 30 minutes fits nothing,
// 45 minutes fits both, and one click logs the play into the diary.
// ============================================================================

import { addRecord, expect, test, unique } from './fixtures';

test('ask what to play, then log the pick in one click', async ({ page }) => {
  const first = unique('Tonight Album');
  const second = unique('Other Album');
  await addRecord(page.request, first);
  await addRecord(page.request, second);

  await page.goto('/');
  await page.getByRole('link', { name: 'Tonight', exact: true }).click();
  const picks = page.getByRole('list', { name: 'Suggestions' });
  await expect(picks.getByRole('heading', { level: 2 })).toHaveCount(2);
  await expect(page.getByText('2 of your records fit')).toBeVisible();

  // Both records run 40 minutes, so 30 minutes fits neither...
  await page.getByRole('button', { name: '30 min' }).click();
  await expect(page.getByRole('heading', { name: 'Nothing on your shelf fits' })).toBeVisible();

  // ...and 45 minutes fits both, whole.
  await page.getByRole('button', { name: '45 min' }).click();
  await expect(page).toHaveURL(/minutes=45/);
  const card = picks.getByRole('listitem').filter({ hasText: first });
  await expect(card).toContainText('Never played');
  await expect(card).toContainText('The whole record fits (40:00)');

  // One click logs it, and it shows up in the diary.
  await card.getByRole('button', { name: '▶ Play this now' }).click();
  await expect(card.getByRole('status')).toHaveText('✓ Logged. Enjoy!');

  await page.getByRole('link', { name: 'Diary', exact: true }).click();
  const entry = page.getByRole('listitem').filter({ hasText: first });
  await expect(entry).toContainText('Whole record · 40:00');
});
