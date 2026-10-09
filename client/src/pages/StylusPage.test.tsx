// ============================================================================
// StylusPage.test.tsx: TESTS FOR THE STYLUS WEAR TRACKER
// ============================================================================

import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Stylus } from '@vinyl/shared';
import { apiError, json, mockApi } from '../test/fake-api';
import { renderApp } from '../test/render';

function makeStylus(overrides: Partial<Stylus> = {}): Stylus {
  return {
    id: 1,
    name: 'AT-VM540ML',
    ratedHours: 500,
    initialHours: 0,
    installedAt: '2026-01-15T12:00:00.000Z',
    retiredAt: null,
    hoursUsed: 123.4,
    spinCount: 180,
    percentUsed: 25,
    status: 'ok',
    averageSpinSeconds: 2400, // 40 minutes
    ...overrides,
  };
}

describe('StylusPage', () => {
  it('shows the wear of the stylus in use and an estimate of what is left', async () => {
    mockApi({ 'GET /api/styluses': () => json({ styluses: [makeStylus()] }) });

    renderApp('/stylus');

    const card = await screen.findByRole('region', { name: 'Stylus in use' });
    expect(within(card).getByRole('heading', { name: 'AT-VM540ML' })).toBeInTheDocument();
    expect(within(card).getByText(/180 plays logged/)).toBeInTheDocument();
    expect(within(card).getByRole('meter', { name: 'Stylus wear' })).toHaveAttribute(
      'aria-valuenow',
      '25',
    );
    expect(card).toHaveTextContent('✓ Good');
    expect(card).toHaveTextContent('123 h of 500 h · 25%');
    // 376.6 hours left at 40 minutes a play = 564 plays.
    expect(card).toHaveTextContent('About 377 h left, roughly 564 more plays');
  });

  it('says plainly when it is time to replace', async () => {
    mockApi({
      'GET /api/styluses': () =>
        json({
          styluses: [makeStylus({ hoursUsed: 560, percentUsed: 112, status: 'replace' })],
        }),
    });

    renderApp('/stylus');

    const card = await screen.findByRole('region', { name: 'Stylus in use' });
    expect(card).toHaveTextContent('⛔ Time to replace');
    expect(card).toHaveTextContent("It's 60 h past its rating");
    // The meter stays full rather than overflowing.
    expect(within(card).getByRole('meter')).toHaveAttribute('aria-valuenow', '100');
  });

  it('asks you to add a stylus when there is none', async () => {
    const api = mockApi({
      'GET /api/styluses': () => json({ styluses: [] }),
      'POST /api/styluses': ({ body }) => json(makeStylus(body as Partial<Stylus>), 201),
    });
    const { user } = renderApp('/stylus');

    await user.type(await screen.findByLabelText('Stylus'), 'Ortofon 2M Red');
    const rated = screen.getByLabelText('Rated hours');
    await user.clear(rated);
    await user.type(rated, '800');
    await user.click(screen.getByRole('button', { name: 'Add stylus' }));

    await waitFor(() =>
      expect(api.calls.find((c) => c.method === 'POST')?.body).toMatchObject({
        name: 'Ortofon 2M Red',
        ratedHours: 800,
        initialHours: 0,
      }),
    );
  });

  it('checks the form before sending', async () => {
    const api = mockApi({ 'GET /api/styluses': () => json({ styluses: [] }) });
    const { user } = renderApp('/stylus');

    await user.click(await screen.findByRole('button', { name: 'Add stylus' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Give the stylus a name');
    expect(api.calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it("shows the server's reason if installing fails", async () => {
    mockApi({
      'GET /api/styluses': () => json({ styluses: [makeStylus()] }),
      'POST /api/styluses': () =>
        apiError(
          400,
          'INSTALLED_BEFORE_CURRENT',
          'The new stylus must be installed after the current one',
        ),
    });
    const { user } = renderApp('/stylus');

    await user.click(await screen.findByRole('button', { name: 'Install a new stylus' }));
    await user.type(screen.getByLabelText('Stylus'), 'Shibata');
    await user.click(screen.getByRole('button', { name: 'Install new stylus' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'must be installed after the current one',
    );
  });

  it('edits the stylus in use', async () => {
    const api = mockApi({
      'GET /api/styluses': () => json({ styluses: [makeStylus()] }),
      'PUT /api/styluses/1': ({ body }) => json(makeStylus(body as Partial<Stylus>)),
    });
    const { user } = renderApp('/stylus');

    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    const initial = screen.getByLabelText('Hours already on it');
    await user.clear(initial);
    await user.type(initial, '40');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(api.calls.find((c) => c.method === 'PUT')?.body).toEqual({
        name: 'AT-VM540ML',
        ratedHours: 500,
        initialHours: 40,
      }),
    );
  });

  it('lists past styluses and can delete one', async () => {
    const api = mockApi({
      'GET /api/styluses': () =>
        json({
          styluses: [
            makeStylus(),
            makeStylus({
              id: 2,
              name: 'Old conical',
              retiredAt: '2026-01-15T12:00:00.000Z',
              installedAt: '2024-06-01T12:00:00.000Z',
              hoursUsed: 410,
              percentUsed: 103,
              status: 'replace',
            }),
          ],
        }),
      'DELETE /api/styluses/2': () => new Response(null, { status: 204 }),
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { user } = renderApp('/stylus');

    const past = await screen.findByRole('region', { name: 'Past styluses' });
    expect(past).toHaveTextContent('Old conical');
    expect(past).toHaveTextContent('410 h');
    expect(past).toHaveTextContent('103% of its rating');

    await user.click(within(past).getByRole('button', { name: 'Delete Old conical' }));
    await waitFor(() => expect(api.calls.some((c) => c.method === 'DELETE')).toBe(true));
  });
});

describe('Stylus banner', () => {
  it('warns on other pages once the stylus is getting worn', async () => {
    mockApi({
      'GET /api/records': () => json({ records: [] }),
      'GET /api/styluses': () =>
        json({ styluses: [makeStylus({ percentUsed: 82, status: 'soon' })] }),
    });

    renderApp('/');

    const banner = await screen.findByText(/has used 82% of its rated hours/);
    expect(banner.closest('div')).toHaveTextContent('⚠');
    expect(screen.getByRole('link', { name: 'Stylus details' })).toHaveAttribute('href', '/stylus');
  });

  it('stays hidden while the stylus is fine', async () => {
    mockApi({
      'GET /api/records': () => json({ records: [] }),
      'GET /api/styluses': () => json({ styluses: [makeStylus()] }),
    });

    renderApp('/');
    await screen.findByText('Server: ok');

    expect(screen.queryByRole('link', { name: 'Stylus details' })).not.toBeInTheDocument();
  });
});

describe('formatStylusHours', () => {
  it('drops a trailing .0 and rounds from 100 hours up', async () => {
    const { formatStylusHours } = await import('../features/stylus/status');
    expect(formatStylusHours(12.5)).toBe('12.5 h');
    expect(formatStylusHours(60)).toBe('60 h');
    expect(formatStylusHours(59.96)).toBe('60 h');
    expect(formatStylusHours(123.4)).toBe('123 h');
  });
});
