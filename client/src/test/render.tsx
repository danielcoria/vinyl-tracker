// ============================================================================
// render.tsx: DRAWS THE WHOLE APP IN A TEST, AT ANY ADDRESS
//
//   const { user } = renderApp('/records/1');
//   await user.click(screen.getByRole('button', { name: 'Delete' }));
//
// It sets things up the same way main.tsx does, but with a pretend address bar
// (MemoryRouter) so tests can start on any page. `user` types and clicks like a person.
// ============================================================================

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { App } from '../App';

/** Shows the current address in the page so tests can check where they ended up. */
function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname + location.search}</output>;
}

export function renderApp(route = '/') {
  // retry: false -> if a request fails, fail right away instead of retrying (keeps tests fast).
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  // delay: null -> type without pausing between keys (much faster, same result).
  const user = userEvent.setup({ delay: null });
  const result = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <App />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { user, ...result };
}
