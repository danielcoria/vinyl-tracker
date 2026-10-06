// ============================================================================
// App.test.tsx: AUTOMATIC CHECKS FOR THE MAIN SCREEN
//
// Tests are small programs that use our code and check it behaves correctly.
// `npm test` runs them all. If one fails, something broke.
//
// The words you'll see in every test file:
//   describe('...')  groups related tests under a name
//   it('...')        one test; the text says what should be true
//   expect(x)...     the actual check, e.g. "expect this text to be on screen"
// ============================================================================

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

/** Draw <App /> on a fake page, set up the same way main.tsx does it. */
function renderApp() {
  // retry: false -> if a request fails, don't keep retrying (keeps tests fast).
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>,
  );
}

describe('App', () => {
  afterEach(() => {
    // Undo the fake `fetch` below after each test, so tests don't affect each other.
    vi.unstubAllGlobals();
  });

  it('shows the API status when the server is up', async () => {
    // We don't start a real server in this test. Instead we replace the
    // browser's `fetch` with a fake that pretends the server answered "ok".
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ status: 'ok', uptimeSeconds: 1 })),
    );

    renderApp();

    // Wait until "API: ok" appears on the page.
    expect(await screen.findByText('API: ok')).toBeInTheDocument();
  });

  it('shows unreachable when the request fails', async () => {
    // This fake `fetch` pretends the server is down.
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    renderApp();

    expect(await screen.findByText('API: unreachable')).toBeInTheDocument();
  });
});
