// ============================================================================
// DustPage.test.tsx: TESTS FOR THE DUST REPORT PAGE
// ============================================================================

import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DustRecord, DustReport } from '@vinyl/shared';
import { formatDaysAgo } from '../features/dust/time-ago';
import { json, mockApi } from '../test/fake-api';
import { renderApp } from '../test/render';

function dustRecord(id: number, title: string, overrides: Partial<DustRecord> = {}): DustRecord {
  return {
    record: { id, title, artists: [{ id, name: `Artist ${id}` }], coverImageUrl: null },
    addedAt: '2025-01-01T00:00:00.000Z',
    lastPlayedAt: '2026-05-01T00:00:00.000Z',
    spinCount: 3,
    days: 120,
    ...overrides,
  };
}

const REPORT: DustReport = {
  thresholdDays: 90,
  collectionCount: 14,
  dusty: [dustRecord(1, 'Rumours'), dustRecord(2, 'Blue', { days: 95, spinCount: 1 })],
  neverPlayed: [dustRecord(3, 'Discovery', { lastPlayedAt: null, spinCount: 0, days: 400 })],
};

describe('DustPage', () => {
  it('lists records gathering dust and never played', async () => {
    mockApi({ 'GET /api/dust': () => json(REPORT) });

    renderApp('/dust');

    expect(await screen.findByText(/3 of 14/)).toBeInTheDocument();
    const dusty = screen.getByRole('region', { name: /Gathering dust/ });
    const cards = within(dusty).getAllByRole('link');
    expect(cards[0]).toHaveTextContent('Rumours');
    expect(cards[0]).toHaveTextContent('Last played 4 months ago · 3 plays');
    expect(cards[1]).toHaveTextContent('1 play');
    expect(cards[0]).toHaveAttribute('href', '/records/1');

    const never = screen.getByRole('region', { name: /Never played/ });
    expect(within(never).getByRole('link')).toHaveTextContent('Added last year');
  });

  it('saves a new number of days and reloads the report', async () => {
    let threshold = 90;
    const api = mockApi({
      'GET /api/dust': () => json({ ...REPORT, thresholdDays: threshold }),
      'PUT /api/settings': ({ body }) => {
        threshold = (body as { dustThresholdDays: number }).dustThresholdDays;
        return json({ dustThresholdDays: threshold });
      },
    });
    const { user } = renderApp('/dust');

    await user.selectOptions(await screen.findByLabelText('Days without a play'), '1 year');

    expect(api.calls.find((c) => c.method === 'PUT')?.body).toEqual({ dustThresholdDays: 365 });
    await waitFor(() => expect(screen.getByLabelText('Days without a play')).toHaveValue('365'));
  });

  it('"Pick one for me" opens a random forgotten record', async () => {
    mockApi({ 'GET /api/dust': () => json(REPORT) });
    // Math.random() = 0.99 picks the last of the three (Discovery, id 3).
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const { user } = renderApp('/dust');

    await user.click(await screen.findByRole('button', { name: /Pick one for me/ }));

    expect(screen.getByTestId('location')).toHaveTextContent('/records/3');
  });

  it('celebrates when nothing is gathering dust', async () => {
    mockApi({ 'GET /api/dust': () => json({ ...REPORT, dusty: [], neverPlayed: [] }) });

    renderApp('/dust');

    expect(
      await screen.findByRole('heading', { name: 'Nothing gathering dust' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Pick one/ })).not.toBeInTheDocument();
  });

  it('points to Discogs when the collection is empty', async () => {
    mockApi({
      'GET /api/dust': () => json({ ...REPORT, collectionCount: 0, dusty: [], neverPlayed: [] }),
    });

    renderApp('/dust');

    expect(await screen.findByRole('heading', { name: 'No records yet' })).toBeInTheDocument();
  });
});

describe('formatDaysAgo', () => {
  it('picks a sensible unit', () => {
    expect(formatDaysAgo(0)).toBe('today');
    expect(formatDaysAgo(1)).toBe('yesterday');
    expect(formatDaysAgo(10)).toBe('10 days ago');
    expect(formatDaysAgo(30)).toBe('4 weeks ago');
    expect(formatDaysAgo(120)).toBe('4 months ago');
    expect(formatDaysAgo(800)).toBe('2 years ago');
  });
});
