// ============================================================================
// RecordPlays.test.tsx: TESTS FOR LOGGING A PLAY ON A RECORD'S PAGE
// ============================================================================

import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Spin } from '@vinyl/shared';
import { json, KIND_OF_BLUE_TRACKS, makeRecord, makeSpin, mockApi } from '../../test/fake-api';
import { renderApp } from '../../test/render';

const RECORD = makeRecord({ id: 1, runtimeSeconds: 2744 });

/** A pretend server that remembers plays as they're logged. */
function serverWithTracks(tracks = KIND_OF_BLUE_TRACKS) {
  const logged: Spin[] = [];
  const api = mockApi({
    'GET /api/records/1': () =>
      json({ ...RECORD, spinCount: logged.length, lastPlayedAt: logged[0]?.playedAt ?? null }),
    'GET /api/records/1/tracks': () => json({ tracks }),
    'GET /api/spins': () => json({ spins: logged }),
    'POST /api/spins': ({ body }) => {
      const input = body as { playedAt: string; sides: string[] | null; durationSeconds: number };
      const spin = makeSpin({ id: logged.length + 1, ...input });
      logged.unshift(spin);
      return json(spin, 201);
    },
  });
  return { api, logged };
}

const posted = (api: ReturnType<typeof mockApi>) =>
  api.calls.find((c) => c.method === 'POST' && c.path === '/api/spins')?.body as
    Record<string, unknown> | undefined;

describe('Log a play', () => {
  it('logs the whole record in one click', async () => {
    const { api } = serverWithTracks();
    const { user } = renderApp('/records/1');

    await user.click(await screen.findByRole('button', { name: '▶ Log a play' }));
    const panel = screen.getByRole('form', { name: 'Log a play' });
    // Both sides start ticked, with their lengths, and the total is filled in.
    expect(within(panel).getByRole('checkbox', { name: /Side A/ })).toBeChecked();
    expect(within(panel).getByRole('checkbox', { name: /Side B/ })).toBeChecked();
    expect(within(panel).getByLabelText('Length')).toHaveValue('45:01');

    const before = Date.now();
    await user.click(within(panel).getByRole('button', { name: 'Log play' }));

    expect(await screen.findByText('Logged: Whole record.')).toBeInTheDocument();
    const body = posted(api);
    expect(body).toMatchObject({ recordId: 1, sides: null, durationSeconds: 2701 });
    // "I just finished": the play started one album-length ago.
    const startedAt = Date.parse(body?.playedAt as string);
    expect(before - startedAt).toBeGreaterThanOrEqual(2701 * 1000 - 1000);
    expect(before - startedAt).toBeLessThan(2701 * 1000 + 5000);
    // The play count and the play list update.
    expect(await screen.findByText(/Played 1 time/)).toBeInTheDocument();
  });

  it('logs only the sides you tick, with their length', async () => {
    const { api } = serverWithTracks();
    const { user } = renderApp('/records/1');

    await user.click(await screen.findByRole('button', { name: '▶ Log a play' }));
    await user.click(screen.getByRole('checkbox', { name: /Side B/ }));
    expect(screen.getByLabelText('Length')).toHaveValue('23:55');
    await user.click(screen.getByRole('radio', { name: "I'm starting now" }));
    await user.click(screen.getByRole('button', { name: 'Log play' }));

    expect(await screen.findByText('Logged: Side A.')).toBeInTheDocument();
    expect(posted(api)).toMatchObject({ sides: ['A'], durationSeconds: 1435 });
  });

  it('can log a play from earlier, with a typed length and notes', async () => {
    const { api } = serverWithTracks();
    const { user } = renderApp('/records/1');

    await user.click(await screen.findByRole('button', { name: '▶ Log a play' }));
    await user.click(screen.getByRole('radio', { name: 'Pick a start time' }));
    const time = screen.getByLabelText('Start time');
    await user.clear(time);
    await user.type(time, '2026-10-01T20:30');
    const length = screen.getByLabelText('Length');
    await user.clear(length);
    await user.type(length, '30:00');
    await user.type(screen.getByLabelText('Notes'), 'With friends');
    await user.click(screen.getByRole('button', { name: 'Log play' }));

    await screen.findByText(/Logged:/);
    expect(posted(api)).toMatchObject({
      playedAt: new Date('2026-10-01T20:30').toISOString(),
      durationSeconds: 1800,
      notes: 'With friends',
    });
  });

  it('asks for at least one side', async () => {
    const { api } = serverWithTracks();
    const { user } = renderApp('/records/1');

    await user.click(await screen.findByRole('button', { name: '▶ Log a play' }));
    await user.click(screen.getByRole('checkbox', { name: /Side A/ }));
    await user.click(screen.getByRole('checkbox', { name: /Side B/ }));
    await user.click(screen.getByRole('button', { name: 'Log play' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Pick at least one side.');
    expect(posted(api)).toBeUndefined();
  });

  it('logs the whole record when there is no tracklist', async () => {
    const { api } = serverWithTracks([]);
    const { user } = renderApp('/records/1');

    await user.click(await screen.findByRole('button', { name: '▶ Log a play' }));
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    // No tracklist, so the album's length is used.
    expect(screen.getByLabelText('Length')).toHaveValue('45:44');
    await user.click(screen.getByRole('button', { name: 'Log play' }));

    await screen.findByText('Logged: Whole record.');
    expect(posted(api)).toMatchObject({ sides: null, durationSeconds: 2744 });
  });
});

describe('Tracklist', () => {
  it('shows songs grouped by side', async () => {
    serverWithTracks();

    renderApp('/records/1');

    const sideA = await screen.findByRole('region', { name: 'Side A' });
    expect(within(sideA).getByText('So What')).toBeInTheDocument();
    expect(within(sideA).getByText('23:55')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Side B' })).toHaveTextContent('Flamenco Sketches');
  });

  it('offers to get the tracklist for records linked before tracklists were saved', async () => {
    let tracks: typeof KIND_OF_BLUE_TRACKS = [];
    const api = mockApi({
      'GET /api/records/1': () => json({ ...RECORD, discogsReleaseId: 2772432 }),
      'GET /api/records/1/tracks': () => json({ tracks }),
      'POST /api/discogs/link': () => {
        tracks = KIND_OF_BLUE_TRACKS;
        return json({ ...RECORD, discogsReleaseId: 2772432 });
      },
    });
    const { user } = renderApp('/records/1');

    await user.click(await screen.findByRole('button', { name: 'Get tracklist from Discogs' }));

    expect(await screen.findByRole('region', { name: 'Side A' })).toBeInTheDocument();
    await waitFor(() =>
      expect(api.calls.find((c) => c.method === 'POST')?.body).toEqual({
        recordId: 1,
        releaseId: 2772432,
      }),
    );
  });
});
