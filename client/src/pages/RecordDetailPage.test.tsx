// ============================================================================
// RecordDetailPage.test.tsx: TESTS FOR ONE RECORD'S PAGE
// ============================================================================

import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { apiError, json, makeRecord, mockApi } from '../test/fake-api';
import { renderApp } from '../test/render';

const RECORD = makeRecord({
  id: 7,
  title: 'Bitches Brew',
  year: 1970,
  label: 'Columbia',
  catalogNumber: 'GP 26',
  format: '2xLP',
  runtimeSeconds: 5637,
  mediaCondition: 'NM',
  sleeveCondition: null,
  notes: 'Gatefold sleeve.',
  genres: ['Jazz'],
  styles: ['Fusion'],
});

describe('RecordDetailPage', () => {
  it('shows the record details', async () => {
    mockApi({ 'GET /api/records/7': () => json(RECORD) });

    renderApp('/records/7');

    expect(await screen.findByRole('heading', { name: 'Bitches Brew' })).toBeInTheDocument();
    expect(screen.getByText('Miles Davis')).toBeInTheDocument();
    expect(screen.getByText('Columbia · GP 26')).toBeInTheDocument();
    expect(screen.getByText('1:33:57')).toBeInTheDocument();
    expect(screen.getByText('NM (Near Mint)')).toBeInTheDocument();
    // No sleeve condition was set, so that row isn't shown at all.
    expect(screen.queryByText('Sleeve')).not.toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Styles' })).toHaveTextContent('Fusion');
    expect(screen.getByText('Gatefold sleeve.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/records/7/edit');
  });

  it('shows not found for a missing record', async () => {
    mockApi({ 'GET /api/records/99': () => apiError(404, 'NOT_FOUND', 'Record 99 not found') });

    renderApp('/records/99');

    expect(await screen.findByRole('heading', { name: 'Not found' })).toBeInTheDocument();
  });

  it("doesn't ask the server about addresses that aren't record numbers", async () => {
    const api = mockApi({});

    renderApp('/records/abc');

    expect(screen.getByRole('heading', { name: 'Not found' })).toBeInTheDocument();
    expect(api.calls.some((c) => c.path.startsWith('/api/records'))).toBe(false);
  });

  it('deletes the record after you confirm, then goes back to the collection', async () => {
    const api = mockApi({
      'GET /api/records/7': () => json(RECORD),
      'DELETE /api/records/7': () => new Response(null, { status: 204 }),
      'GET /api/records': () => json({ records: [] }),
    });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { user } = renderApp('/records/7');

    await user.click(await screen.findByRole('button', { name: 'Delete' }));

    expect(confirm).toHaveBeenCalledWith("Delete “Bitches Brew”? This can't be undone.");
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/));
    expect(api.calls.some((c) => c.method === 'DELETE')).toBe(true);
  });

  it('keeps the record if you cancel', async () => {
    const api = mockApi({ 'GET /api/records/7': () => json(RECORD) });
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { user } = renderApp('/records/7');

    await user.click(await screen.findByRole('button', { name: 'Delete' }));

    expect(api.calls.some((c) => c.method === 'DELETE')).toBe(false);
    expect(screen.getByTestId('location')).toHaveTextContent('/records/7');
  });
});
