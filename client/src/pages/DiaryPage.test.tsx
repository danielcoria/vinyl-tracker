// ============================================================================
// DiaryPage.test.tsx: TESTS FOR THE LISTENING DIARY
// ============================================================================

import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { json, makeSpin, mockApi } from '../test/fake-api';
import { renderApp } from '../test/render';
import { formatDay } from '../features/spins/dates';

// Local noon times, so they land on the same local day in any time zone.
const OCT_6_EVENING = new Date(2026, 9, 6, 20, 0).toISOString();
const OCT_6_NOON = new Date(2026, 9, 6, 12, 0).toISOString();
const OCT_2 = new Date(2026, 9, 2, 12, 0).toISOString();

const SPINS = [
  makeSpin({ id: 3, playedAt: OCT_6_EVENING, sides: ['A'], notes: 'Rainy day' }),
  makeSpin({
    id: 2,
    playedAt: OCT_6_NOON,
    sides: null,
    durationSeconds: 2175,
    record: {
      id: 2,
      title: 'Blue',
      artists: [{ id: 2, name: 'Joni Mitchell' }],
      coverImageUrl: null,
    },
  }),
  makeSpin({ id: 1, playedAt: OCT_2, sides: ['A', 'B'] }),
];

describe('DiaryPage', () => {
  it('lists plays newest first, grouped by day', async () => {
    mockApi({ 'GET /api/spins': () => json({ spins: SPINS }) });

    renderApp('/diary');

    const oct6 = await screen.findByRole('region', { name: formatDay(OCT_6_NOON) });
    const entries = within(oct6).getAllByRole('listitem');
    expect(entries).toHaveLength(2);
    expect(entries[0]).toHaveTextContent('Kind of Blue');
    expect(entries[0]).toHaveTextContent('Side A · 23:55');
    expect(entries[0]).toHaveTextContent('Rainy day');
    expect(entries[1]).toHaveTextContent('Joni Mitchell');
    expect(entries[1]).toHaveTextContent('Whole record · 36:15');
    expect(within(oct6).getByRole('link', { name: 'Blue' })).toHaveAttribute('href', '/records/2');

    const oct2 = screen.getByRole('region', { name: formatDay(OCT_2) });
    expect(oct2).toHaveTextContent('Sides A & B');
  });

  it('deletes a play after you confirm', async () => {
    let spins = SPINS;
    const api = mockApi({
      'GET /api/spins': () => json({ spins }),
      'DELETE /api/spins/3': () => {
        spins = spins.filter((s) => s.id !== 3);
        return new Response(null, { status: 204 });
      },
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { user } = renderApp('/diary');

    const [first] = await screen.findAllByRole('button', { name: /Delete play/ });
    if (!first) throw new Error('no delete buttons');
    await user.click(first);

    await waitFor(() => expect(screen.queryByText('Rainy day')).not.toBeInTheDocument());
    expect(api.calls.some((c) => c.method === 'DELETE' && c.path === '/api/spins/3')).toBe(true);
  });

  it('explains how to start when there are no plays', async () => {
    mockApi({});

    renderApp('/diary');

    expect(await screen.findByRole('heading', { name: 'No plays yet' })).toBeInTheDocument();
  });
});
