// ============================================================================
// StatsPage.test.tsx: TESTS FOR THE STATS PAGE
// ============================================================================

import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RATING_STEPS, type Stats } from '@vinyl/shared';
import { json, mockApi } from '../test/fake-api';
import { renderApp } from '../test/render';
// The app loads the Stats page lazily (on first visit). Loading it here, before
// the tests run, keeps the first test from waiting on that download.
import './StatsPage';

const STATS: Stats = {
  totals: { spinCount: 24, listeningSeconds: 45_000, recordCount: 9, artistCount: 11 },
  topArtists: [
    { id: 1, name: 'Kendrick Lamar', spinCount: 2, listeningSeconds: 4500 },
    { id: 2, name: 'Miles Davis', spinCount: 3, listeningSeconds: 3900 },
  ],
  topRecords: [
    {
      record: {
        id: 7,
        title: 'To Pimp a Butterfly',
        artists: [{ id: 1, name: 'Kendrick Lamar' }],
        coverImageUrl: null,
      },
      spinCount: 2,
      listeningSeconds: 4500,
    },
  ],
  genresByMonth: {
    months: ['2026-09', '2026-10'],
    genres: [
      { name: 'Jazz', seconds: [2700, 2700] },
      { name: 'Rock', seconds: [0, 3000] },
    ],
  },
  // Three records rated: two with 5 stars, one with 3.5.
  ratings: {
    ratedCount: 3,
    average: 4.5,
    counts: RATING_STEPS.map((rating) => ({
      rating,
      count: rating === 5 ? 2 : rating === 3.5 ? 1 : 0,
    })),
  },
};

const EMPTY: Stats = {
  totals: { spinCount: 0, listeningSeconds: 0, recordCount: 0, artistCount: 0 },
  topArtists: [],
  topRecords: [],
  genresByMonth: { months: [], genres: [] },
  ratings: {
    ratedCount: 0,
    average: null,
    counts: RATING_STEPS.map((rating) => ({ rating, count: 0 })),
  },
};

describe('StatsPage', () => {
  it('shows the totals and the most-listened artists and records', async () => {
    mockApi({ 'GET /api/stats': () => json(STATS) });

    renderApp('/stats');

    const tiles = await screen.findByText('Listening time');
    expect(tiles.closest('div')).toHaveTextContent('12.5 h');
    expect(screen.getByText('Plays').closest('div')).toHaveTextContent('24');

    const artists = screen.getByRole('region', { name: 'Most-listened artists' });
    const rows = within(artists).getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('Kendrick Lamar');
    expect(rows[0]).toHaveTextContent('1 h 15 min · 2 plays');
    expect(rows[1]).toHaveTextContent('Miles Davis');

    const records = screen.getByRole('region', { name: 'Most-listened records' });
    expect(within(records).getByRole('link', { name: 'To Pimp a Butterfly' })).toHaveAttribute(
      'href',
      '/records/7',
    );
  });

  it('shows how the ratings are spread, highest first', async () => {
    mockApi({ 'GET /api/stats': () => json(STATS) });

    renderApp('/stats');

    const ratings = await screen.findByRole('region', { name: 'Your ratings' });
    expect(ratings).toHaveTextContent('3 rated · average 4.5');
    const rows = within(ratings).getAllByRole('listitem');
    expect(rows).toHaveLength(10);
    // 5 stars is the first row, with its 2 records.
    expect(
      within(rows[0] as HTMLElement).getByRole('img', { name: '5 stars' }),
    ).toBeInTheDocument();
    expect(rows[0]).toHaveTextContent('2');
  });

  it('leaves the ratings out when nothing is rated', async () => {
    mockApi({ 'GET /api/stats': () => json(EMPTY) });

    renderApp('/stats');

    await screen.findByRole('heading', { name: /No plays/ });
    expect(screen.queryByRole('region', { name: 'Your ratings' })).not.toBeInTheDocument();
  });

  it('shows genres by month, with a legend and a table view', async () => {
    mockApi({ 'GET /api/stats': () => json(STATS) });
    const { user } = renderApp('/stats');

    const chart = await screen.findByRole('region', { name: 'Genres by month' });
    expect(within(chart).getByRole('list', { name: 'Genres' })).toHaveTextContent('JazzRock');

    await user.click(within(chart).getByRole('button', { name: 'Show as table' }));

    const table = within(chart).getByRole('table');
    const october = within(table).getByRole('row', { name: /Oct/ });
    // Jazz 45 min, Rock 50 min, total 1 h 35 min
    expect(october).toHaveTextContent('45 min');
    expect(october).toHaveTextContent('50 min');
    expect(october).toHaveTextContent('1 h 35 min');
    // A genre with no time that month shows a dash.
    expect(within(table).getByRole('row', { name: /Sep/ })).toHaveTextContent('–');
  });

  it('asks for "this year" by default and switches periods', async () => {
    const api = mockApi({ 'GET /api/stats': () => json(STATS) });
    const { user } = renderApp('/stats');
    await screen.findByText('Listening time');

    const first = api.calls.find((c) => c.path === '/api/stats');
    expect(first?.search.get('from')).toBe(new Date(new Date().getFullYear(), 0, 1).toISOString());
    expect(first?.search.has('utcOffsetMinutes')).toBe(true);
    expect(screen.getByRole('button', { name: 'This year' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await user.click(screen.getByRole('button', { name: 'All time' }));

    await waitFor(() =>
      expect(
        api.calls
          .filter((c) => c.path === '/api/stats')
          .at(-1)
          ?.search.has('from'),
      ).toBe(false),
    );
    expect(screen.getByTestId('location')).toHaveTextContent('/stats?period=all');
  });

  it('explains where stats come from when there are no plays', async () => {
    mockApi({ 'GET /api/stats': () => json(EMPTY) });

    renderApp('/stats?period=all');

    expect(await screen.findByRole('heading', { name: 'No plays yet' })).toBeInTheDocument();
  });
});
