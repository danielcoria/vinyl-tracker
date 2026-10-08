// ============================================================================
// App.test.tsx: TESTS FOR THE FRAME AROUND EVERY SCREEN
//
// The words you'll see in every test file:
//   describe('...')  groups related tests under a name
//   it('...')        one test; the text says what should be true
//   expect(x)...     the actual check, e.g. "expect this text to be on screen"
// ============================================================================

import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { json, mockApi } from './test/fake-api';
import { renderApp } from './test/render';

describe('Layout', () => {
  it('shows that the server is reachable', async () => {
    mockApi({ 'GET /api/records': () => json({ records: [] }) });

    renderApp();

    expect(await screen.findByText('Server: ok')).toBeInTheDocument();
  });

  it('shows when the server is unreachable', async () => {
    // A fake `fetch` that always fails, like when the server isn't running.
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('Failed to fetch')));

    renderApp();

    expect(await screen.findByText('Server: unreachable')).toBeInTheDocument();
  });

  it('shows a not-found page for unknown addresses', async () => {
    mockApi({});

    renderApp('/nowhere');

    expect(screen.getByRole('heading', { name: 'Not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to your collection' })).toHaveAttribute(
      'href',
      '/',
    );
  });
});
