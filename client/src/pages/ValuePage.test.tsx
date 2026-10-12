// ============================================================================
// ValuePage.test.tsx: TESTS FOR THE COLLECTION VALUE PAGE
// ============================================================================

import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { CollectionValue, ValuedRecord } from '@vinyl/shared';
import { formatPrice } from '../features/streaming/format';
import { formatChange, formatDay, formatPercent } from '../features/value/format';
import { apiError, json, mockApi } from '../test/fake-api';
import { renderApp } from '../test/render';
// The page is loaded lazily (it brings the chart code). Loading it here, before
// the tests run, keeps the first test from waiting on that download.
import './ValuePage';

function valued(id: number, title: string, price: number | null, firstPrice = price): ValuedRecord {
  return {
    record: { id, title, artists: [{ id, name: `Artist ${id}` }], coverImageUrl: null },
    price,
    firstPrice,
    numForSale: price === null ? 0 : 12,
    capturedAt: '2026-10-12T10:00:00.000Z',
  };
}

const VALUE: CollectionValue = {
  currency: 'USD',
  sample: false,
  totals: {
    value: 96,
    recordCount: 6,
    pricedCount: 2,
    notForSaleCount: 1,
    pendingCount: 1,
    unlinkedCount: 2,
  },
  movement: { amount: 6, ratio: 0.15, since: '2026-10-01' },
  history: [
    { date: '2026-10-01', value: 50, pricedCount: 2 },
    { date: '2026-10-02', value: 66, pricedCount: 3 },
    { date: '2026-10-12', value: 96, pricedCount: 2 },
  ],
  records: [
    valued(1, 'Kind of Blue', 60, 54),
    valued(2, 'Blue Train', 36),
    valued(3, 'Rare One', null),
  ],
  lastUpdatedAt: '2026-10-12T10:00:00.000Z',
};

const EMPTY_TOTALS = {
  value: 0,
  recordCount: 0,
  pricedCount: 0,
  notForSaleCount: 0,
  pendingCount: 0,
  unlinkedCount: 0,
};

const NOTHING: CollectionValue = {
  currency: null,
  sample: false,
  totals: EMPTY_TOTALS,
  movement: null,
  history: [],
  records: [],
  lastUpdatedAt: null,
};

describe('wording', () => {
  it('writes days, changes and percentages', () => {
    expect(formatDay('2026-10-12')).toMatch(/Oct.*12|12.*Oct/);
    expect(formatDay('2026-10-12', true)).toContain('2026');
    expect(formatChange(6, 'USD')).toBe(`up ${formatPrice(6, 'USD')}`);
    expect(formatChange(-2.5, 'USD')).toBe(`down ${formatPrice(2.5, 'USD')}`);
    expect(formatChange(0, 'USD')).toBe('no change');
    expect(formatPercent(0.153)).toBe('15%');
    // Whole numbers for chart axes.
    expect(formatPrice(480.4, 'USD', true)).not.toContain('.');
  });
});

describe('ValuePage', () => {
  it('shows the total, how prices moved, and the records by value', async () => {
    mockApi({ 'GET /api/value': () => json(VALUE) });

    renderApp('/value');

    const total = await screen.findByText('Collection value', { selector: 'dt' });
    expect(total.closest('div')).toHaveTextContent(formatPrice(96, 'USD'));
    expect(screen.getByText('Records priced').closest('div')).toHaveTextContent('2 of 6');
    expect(screen.getByText(/^Prices since/).closest('div')).toHaveTextContent(
      `up ${formatPrice(6, 'USD')} (15%)`,
    );
    expect(screen.getByText('Most valuable').closest('div')).toHaveTextContent('Kind of Blue');

    const list = screen.getByRole('region', { name: 'Records by value' });
    const rows = within(list).getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('Kind of Blue');
    // 60 now, 54 when first tracked.
    expect(rows[0]).toHaveTextContent(`${formatPrice(60, 'USD')} · up ${formatPrice(6, 'USD')}`);
    expect(rows[1]).toHaveTextContent(formatPrice(36, 'USD'));
    expect(rows[1]).not.toHaveTextContent('up');
    expect(rows[2]).toHaveTextContent('None for sale');
    expect(
      within(rows[0] as HTMLElement).getByRole('link', { name: 'Kind of Blue' }),
    ).toHaveAttribute('href', '/records/1');
  });

  it('explains which records are not counted', async () => {
    mockApi({ 'GET /api/value': () => json(VALUE) });

    renderApp('/value');

    const note = await screen.findByText(/cheapest copy of that pressing/);
    expect(note).toHaveTextContent('1 has no copy for sale right now.');
    expect(note).toHaveTextContent('1 is waiting for a first price.');
    expect(note).toHaveTextContent("2 aren't linked to Discogs");
  });

  it('shows the history as a chart, or as a table', async () => {
    mockApi({ 'GET /api/value': () => json(VALUE) });
    const { user } = renderApp('/value');

    const chart = await screen.findByRole('region', { name: 'Value over time' });
    expect(within(chart).getByRole('img')).toHaveAccessibleName(/Collection value from .* to /);

    await user.click(within(chart).getByRole('button', { name: 'Show as table' }));

    const rows = within(chart).getAllByRole('row');
    expect(rows).toHaveLength(4); // header + 3 days
    // Newest first.
    expect(rows[1]).toHaveTextContent(formatPrice(96, 'USD'));
    expect(rows[3]).toHaveTextContent(formatPrice(50, 'USD'));
  });

  it('waits for a second day of prices before drawing the chart', async () => {
    mockApi({
      'GET /api/value': () =>
        json({ ...VALUE, history: VALUE.history.slice(0, 1), movement: null }),
    });

    renderApp('/value');

    expect(await screen.findByText(/The chart appears once prices/)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Value over time' })).not.toBeInTheDocument();
    expect(screen.getByText('Price movement').closest('div')).toHaveTextContent('Not yet known');
  });

  it('updates prices on request and says what happened', async () => {
    let refreshed = false;
    const api = mockApi({
      'GET /api/value': () =>
        json(
          refreshed
            ? VALUE
            : { ...NOTHING, totals: { ...EMPTY_TOTALS, recordCount: 3, pendingCount: 3 } },
        ),
      'POST /api/value/refresh': () => {
        refreshed = true;
        return json({ updated: 2, remaining: 1 });
      },
    });
    const { user } = renderApp('/value');

    expect(await screen.findByRole('heading', { name: 'No prices yet' })).toBeInTheDocument();
    expect(screen.getByText(/3 records are waiting for a first price/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Update prices now' }));

    expect(await within(screen.getByRole('main')).findByRole('status')).toHaveTextContent(
      'Updated 2 prices. 1 more to go: click again in a minute.',
    );
    // The page now shows the new prices.
    expect(await screen.findByRole('region', { name: 'Records by value' })).toBeInTheDocument();
    expect(api.calls.filter((c) => c.method === 'POST')).toHaveLength(1);
  });

  it('says when prices were already up to date, or could not be updated', async () => {
    let fail = false;
    mockApi({
      'GET /api/value': () => json(VALUE),
      'POST /api/value/refresh': () =>
        fail
          ? apiError(503, 'DISCOGS_NOT_CONFIGURED', 'Discogs is not set up.')
          : json({ updated: 0, remaining: 0 }),
    });
    const { user } = renderApp('/value');
    const button = await screen.findByRole('button', { name: 'Update prices now' });

    await user.click(button);
    expect(await within(screen.getByRole('main')).findByRole('status')).toHaveTextContent(
      'Prices are already up to date.',
    );

    fail = true;
    await user.click(button);
    expect(await screen.findByRole('alert')).toHaveTextContent('Discogs is not set up.');
  });

  it('explains how to get prices when no record is linked to Discogs', async () => {
    mockApi({
      'GET /api/value': () =>
        json({ ...NOTHING, totals: { ...EMPTY_TOTALS, recordCount: 2, unlinkedCount: 2 } }),
    });

    renderApp('/value');

    expect(
      await screen.findByRole('heading', { name: 'Nothing to price yet' }),
    ).toBeInTheDocument();
    // No button: there is nothing it could look up.
    expect(screen.queryByRole('button', { name: 'Update prices now' })).not.toBeInTheDocument();
  });

  it('labels the demo’s sample prices and hides the update button', async () => {
    mockApi({ 'GET /api/value': () => json({ ...VALUE, sample: true }) });

    renderApp('/value');

    expect(await screen.findByRole('note')).toHaveTextContent('Sample data');
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Update prices now' })).not.toBeInTheDocument(),
    );
  });

  it('is in the main menu', async () => {
    mockApi({ 'GET /api/value': () => json(VALUE) });
    renderApp('/value');

    expect(await screen.findByRole('link', { name: 'Value' })).toHaveAttribute('href', '/value');
  });
});
