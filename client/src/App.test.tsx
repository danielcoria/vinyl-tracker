import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

function renderApp() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>,
  );
}

describe('App', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the API status when the server is up', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ status: 'ok', uptimeSeconds: 1 })),
    );

    renderApp();

    expect(await screen.findByText('API: ok')).toBeInTheDocument();
  });

  it('shows unreachable when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    renderApp();

    expect(await screen.findByText('API: unreachable')).toBeInTheDocument();
  });
});
