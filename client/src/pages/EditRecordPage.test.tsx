// ============================================================================
// EditRecordPage.test.tsx: TESTS FOR THE "EDIT A RECORD" SCREEN
// ============================================================================

import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { apiError, json, makeRecord, mockApi } from '../test/fake-api';
import { renderApp } from '../test/render';

const RECORD = makeRecord({ id: 3, title: 'Kind of Blue', runtimeSeconds: 2744 });

describe('EditRecordPage', () => {
  it('fills the form with the record and saves your changes', async () => {
    const api = mockApi({
      'GET /api/records/3': () => json(RECORD),
      'PUT /api/records/3': () => json({ ...RECORD, title: 'Kind of Blue (Mono)' }),
    });
    const { user } = renderApp('/records/3/edit');

    const title = await screen.findByLabelText('Title');
    expect(title).toHaveValue('Kind of Blue');
    expect(screen.getByLabelText('Artist 1')).toHaveValue('Miles Davis');
    expect(screen.getByLabelText('Length')).toHaveValue('45:44');
    expect(screen.getByLabelText('Media condition')).toHaveValue('VG+');

    await user.clear(title);
    await user.type(title, 'Kind of Blue (Mono)');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/records\/3$/));
    const put = api.calls.find((c) => c.method === 'PUT');
    expect(put?.body).toMatchObject({
      title: 'Kind of Blue (Mono)',
      artists: ['Miles Davis'],
      runtimeSeconds: 2744,
      genres: ['Jazz'],
    });
  });

  it('cancel goes back to the record without saving', async () => {
    const api = mockApi({ 'GET /api/records/3': () => json(RECORD) });
    const { user } = renderApp('/records/3/edit');

    await user.click(await screen.findByRole('link', { name: 'Cancel' }));

    expect(screen.getByTestId('location')).toHaveTextContent('/records/3');
    expect(api.calls.some((c) => c.method === 'PUT')).toBe(false);
  });

  it('shows not found for a missing record', async () => {
    mockApi({ 'GET /api/records/3': () => apiError(404, 'NOT_FOUND', 'Record 3 not found') });

    renderApp('/records/3/edit');

    expect(await screen.findByRole('heading', { name: 'Not found' })).toBeInTheDocument();
  });
});
