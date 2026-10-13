// ============================================================================
// scrobbling.test.tsx: TESTS FOR SENDING PLAYS TO LAST.FM, ON THE WEBSITE
//
// The card on the Streaming page (connect / stop), the checkbox when logging
// a play, and the marker each play gets in the diary.
// ============================================================================

import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ScrobblingStatus } from '@vinyl/shared';
import { json, KIND_OF_BLUE_TRACKS, makeRecord, makeSpin, mockApi } from '../../test/fake-api';
import { renderApp } from '../../test/render';

const SETTINGS = { dustThresholdDays: 90, profilePublic: false, lastfmUsername: null };
const CONNECTED: ScrobblingStatus = {
  available: true,
  unavailableReason: null,
  connected: true,
  username: 'vinyl_fan',
};
const NOT_CONNECTED: ScrobblingStatus = {
  available: true,
  unavailableReason: null,
  connected: false,
  username: null,
};

/** The Streaming page with the given scrobbling status (and no Last.fm username saved). */
function streamingPage(status: ScrobblingStatus) {
  let current = status;
  const api = mockApi({
    'GET /api/settings': () => json(SETTINGS),
    'GET /api/lastfm/status': () => json(current),
    'DELETE /api/lastfm/connection': () => {
      current = NOT_CONNECTED;
      return new Response(null, { status: 204 });
    },
  });
  return api;
}

const card = () => screen.findByRole('region', { name: 'Scrobbling' });

describe('the scrobbling card', () => {
  it('offers to connect, with a link that leaves for Last.fm through the server', async () => {
    streamingPage(NOT_CONNECTED);

    renderApp('/streaming');

    const link = within(await card()).getByRole('link', { name: 'Connect to Last.fm' });
    expect(link).toHaveAttribute('href', '/api/lastfm/connect');
    expect(await card()).toHaveTextContent('your Last.fm password is never typed here');
  });

  it('shows who is connected, and stops scrobbling on request', async () => {
    const api = streamingPage(CONNECTED);
    const { user } = renderApp('/streaming');

    expect(await card()).toHaveTextContent(
      "Plays you log are added to vinyl_fan's Last.fm history",
    );

    await user.click(within(await card()).getByRole('button', { name: 'Stop scrobbling' }));

    expect(
      await within(await card()).findByRole('link', { name: 'Connect to Last.fm' }),
    ).toBeInTheDocument();
    expect(
      api.calls.some((c) => c.method === 'DELETE' && c.path === '/api/lastfm/connection'),
    ).toBe(true);
  });

  it('says what is missing when the server has no shared secret', async () => {
    streamingPage({
      available: false,
      unavailableReason: 'not-set-up',
      connected: false,
      username: null,
    });

    renderApp('/streaming');

    expect(await card()).toHaveTextContent("Scrobbling isn't set up on this server yet");
    expect(await card()).toHaveTextContent('LASTFM_SHARED_SECRET');
    expect(screen.queryByRole('link', { name: 'Connect to Last.fm' })).not.toBeInTheDocument();
  });

  it('says so on the shared demo account', async () => {
    streamingPage({
      available: false,
      unavailableReason: 'demo-account',
      connected: false,
      username: null,
    });

    renderApp('/streaming');

    expect(await card()).toHaveTextContent("isn't offered on the shared demo account");
  });

  it('confirms the connection after coming back from Last.fm', async () => {
    streamingPage(CONNECTED);

    renderApp('/streaming?scrobbling=connected');

    expect(await within(await card()).findByRole('status')).toHaveTextContent(
      'Connected. Plays you log from now on go to Last.fm.',
    );
  });

  it('explains when Last.fm did not confirm it', async () => {
    streamingPage(NOT_CONNECTED);

    renderApp('/streaming?scrobbling=failed');

    expect(await within(await card()).findByRole('alert')).toHaveTextContent(
      "Last.fm didn't confirm the connection",
    );
    // They can simply try again.
    expect(
      within(await card()).getByRole('link', { name: 'Connect to Last.fm' }),
    ).toBeInTheDocument();
  });
});

/** A record page whose "Log a play" panel can be opened. */
function recordPage(status: ScrobblingStatus | null, tracks = KIND_OF_BLUE_TRACKS) {
  return mockApi({
    'GET /api/records/1': () => json(makeRecord({ id: 1 })),
    'GET /api/records/1/tracks': () => json({ tracks }),
    ...(status ? { 'GET /api/lastfm/status': () => json(status) } : {}),
    'POST /api/spins': ({ body }) => json(makeSpin(body as object), 201),
  });
}

async function openLogPanel(user: ReturnType<typeof renderApp>['user']) {
  const button = await screen.findByRole('button', { name: '▶ Log a play' });
  await waitFor(() => expect(button).toBeEnabled());
  await user.click(button);
}

const posted = (api: ReturnType<typeof mockApi>) =>
  api.calls.find((c) => c.method === 'POST' && c.path === '/api/spins')?.body as
    Record<string, unknown> | undefined;

describe('scrobbling when logging a play', () => {
  it('is ticked by default when Last.fm is connected, and sent along unless unticked', async () => {
    const api = recordPage(CONNECTED);
    const { user } = renderApp('/records/1');
    await openLogPanel(user);

    const checkbox = await screen.findByRole('checkbox', { name: 'Scrobble to Last.fm' });
    expect(checkbox).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Log play' }));

    await waitFor(() => expect(posted(api)).toBeDefined());
    // Nothing is said about scrobbling: the server sends it because the account is connected.
    expect(posted(api)).not.toHaveProperty('scrobble');
  });

  it('keeps one play off Last.fm when unticked', async () => {
    const api = recordPage(CONNECTED);
    const { user } = renderApp('/records/1');
    await openLogPanel(user);

    await user.click(await screen.findByRole('checkbox', { name: 'Scrobble to Last.fm' }));
    await user.click(screen.getByRole('button', { name: 'Log play' }));

    await waitFor(() => expect(posted(api)).toMatchObject({ scrobble: false }));
  });

  it('is not offered when Last.fm is not connected', async () => {
    recordPage(null);
    const { user } = renderApp('/records/1');
    await openLogPanel(user);

    await screen.findByRole('button', { name: 'Log play' });
    expect(screen.queryByRole('checkbox', { name: /Scrobble/ })).not.toBeInTheDocument();
  });

  it('explains that a record without a tracklist cannot be scrobbled', async () => {
    recordPage(CONNECTED, []);
    const { user } = renderApp('/records/1');
    await openLogPanel(user);

    const checkbox = await screen.findByRole('checkbox', { name: /Scrobble to Last.fm/ });
    expect(checkbox).toBeDisabled();
    expect(checkbox).not.toBeChecked();
    expect(screen.getByText(/this record has no tracklist to send/)).toBeInTheDocument();
  });
});

describe('the diary', () => {
  it('says what happened to each play that was meant for Last.fm', async () => {
    mockApi({
      'GET /api/spins': () =>
        json({
          spins: [
            makeSpin({ id: 1, scrobble: 'sent', notes: 'first' }),
            makeSpin({ id: 2, scrobble: 'pending', notes: 'second' }),
            makeSpin({ id: 3, scrobble: 'failed', notes: 'third' }),
            makeSpin({ id: 4, scrobble: 'skipped', notes: 'fourth' }),
            makeSpin({ id: 5, scrobble: null, notes: 'fifth' }),
          ],
        }),
    });

    renderApp('/diary');

    const entry = async (note: string) =>
      (await screen.findByText(note)).closest('li') as HTMLElement;
    expect(await entry('first')).toHaveTextContent('Scrobbled');
    expect(await entry('second')).toHaveTextContent('Scrobbles when it ends');
    expect(await entry('third')).toHaveTextContent('Scrobbling failed');
    expect(await entry('fourth')).toHaveTextContent('Not scrobbled');
    // A play that was never meant for Last.fm says nothing about it.
    expect(await entry('fifth')).not.toHaveTextContent(/crobbl/);
  });
});
