// ============================================================================
// query-client.ts: THE WEBSITE'S MEMORY OF SERVER ANSWERS (TanStack Query)
//
// One place to set it up, used by main.tsx and by the tests.
// If any request comes back "log in first" (for example, the login expired),
// we note that nobody is logged in, and the app shows the login page.
// ============================================================================

import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import type { MeResponse } from '@vinyl/shared';
import { isNotLoggedIn } from './client';

export function createQueryClient(options: { retry?: boolean } = {}) {
  const queryClient: QueryClient = new QueryClient({
    queryCache: new QueryCache({ onError: handle }),
    mutationCache: new MutationCache({ onError: handle }),
    defaultOptions: {
      // Don't retry "log in first" answers; retrying won't help.
      queries: {
        retry:
          options.retry === false ? false : (count, error) => !isNotLoggedIn(error) && count < 3,
      },
      mutations: { retry: false },
    },
  });

  function handle(error: unknown) {
    if (!isNotLoggedIn(error)) return;
    const loggedOut: MeResponse = { user: null };
    queryClient.setQueryData(['me'], loggedOut);
  }

  return queryClient;
}
