// ============================================================================
// scrobbling.spec.ts: CONNECTING LAST.FM AND SCROBBLING A PLAY
//
// Uses the fake Last.fm (support/fake-discogs.mjs): its "approve this app"
// page says yes straight away, and it remembers every song it's sent, so the
// test can check what really arrived.
// ============================================================================

import { expect, importKindOfBlue, test } from './fixtures';

const FAKE_LASTFM = 'http://localhost:3199';

test('connect Last.fm, scrobble a play, and stop scrobbling', async ({ page }) => {
  const recordId = await importKindOfBlue(page.request);
  const before = ((await (await page.request.get(`${FAKE_LASTFM}/scrobbles`)).json()) as unknown[])
    .length;

  // Connect: the browser goes to (the fake) Last.fm and comes straight back.
  await page.goto('/streaming');
  const card = page.getByRole('region', { name: 'Scrobbling' });
  await card.getByRole('link', { name: 'Connect to Last.fm' }).click();
  await expect(page).toHaveURL(/\/streaming\?scrobbling=connected$/);
  await expect(card.getByRole('status')).toContainText('Connected');
  await expect(card).toContainText("e2e_listener's Last.fm history");

  // Log side A as just finished, with "Scrobble to Last.fm" left ticked.
  await page.goto(`/records/${recordId}`);
  const logButton = page.getByRole('button', { name: '▶ Log a play' });
  await expect(logButton).toBeEnabled();
  await logButton.click();
  await page.getByRole('checkbox', { name: /Side B/ }).uncheck();
  await expect(page.getByRole('checkbox', { name: 'Scrobble to Last.fm' })).toBeChecked();
  await page.getByRole('button', { name: 'Log play' }).click();
  await expect(page.getByText('Logged: Side A.')).toBeVisible();

  // The diary says it was scrobbled, and the fake Last.fm really received side A's songs.
  await page.getByRole('link', { name: 'Diary', exact: true }).click();
  await expect(page.getByRole('listitem').filter({ hasText: 'Kind Of Blue' })).toContainText(
    'Scrobbled',
  );
  const received = (await (await page.request.get(`${FAKE_LASTFM}/scrobbles`)).json()) as {
    artist: string;
    track: string;
    album: string;
    sessionKey: string;
  }[];
  const mine = received.slice(before);
  expect(mine.map((s) => s.track)).toEqual(['So What', 'Freddie Freeloader', 'Blue In Green']);
  expect(mine[0]).toMatchObject({
    artist: 'Miles Davis',
    album: 'Kind Of Blue',
    sessionKey: 'e2e-session-key',
  });

  // Stop scrobbling: the card offers to connect again.
  await page.goto('/streaming');
  await card.getByRole('button', { name: 'Stop scrobbling' }).click();
  await expect(card.getByRole('link', { name: 'Connect to Last.fm' })).toBeVisible();
});
