// ============================================================================
// render.tsx: DRAWS THE WHOLE APP IN A TEST, AT ANY ADDRESS
//
//   const { user } = renderApp('/records/1');
//   await user.click(screen.getByRole('button', { name: 'Delete' }));
//
// It sets things up the same way main.tsx does, but with a pretend address bar
// (MemoryRouter) so tests can start on any page. `user` types and clicks like a person.
// ============================================================================

import { QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { App } from '../App';
import { createQueryClient } from '../api/query-client';
import type { User } from '@vinyl/shared';
import { TEST_USER } from './fake-api';

/** Shows the current address in the page so tests can check where they ended up. */
function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname + location.search}</output>;
}

/**
 * Draws the app at `route`, with `loggedInAs` already logged in (the fake API's
 * TEST_USER unless given). Pass `{ loggedInAs: null }` to start logged out.
 * (The returned `user` is different: it's the pretend person who types and clicks.)
 */
export function renderApp(
  route = '/',
  { loggedInAs = TEST_USER }: { loggedInAs?: User | null } = {},
) {
  // retry: false -> if a request fails, fail right away instead of retrying (keeps tests fast).
  const queryClient = createQueryClient({ retry: false });
  // Start already knowing who's logged in, so pages appear straight away.
  queryClient.setQueryData(['me'], { user: loggedInAs });
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
