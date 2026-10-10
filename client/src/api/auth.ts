// ============================================================================
// api/auth.ts: HOOKS FOR ACCOUNTS
//
//   useMe()          who is logged in (user, or null)
//   useLogin()       log in with username + password
//   useSignup()      make an account (and log in)
//   useDemoLogin()   "Try the demo" on the demo site
//   useLogout()      log out
//
// Logging in or out wipes everything the website remembered (TanStack Query's
// cache), so one person's records never flash up for the next person.
// ============================================================================

import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import {
  meResponseSchema,
  type LoginInput,
  type MeResponse,
  type SignupInput,
} from '@vinyl/shared';
import { apiGet, apiPost, apiSend } from './client';

export const meKey = ['me'] as const;

export function useMe() {
  return useQuery({
    queryKey: meKey,
    queryFn: () => apiGet('/api/auth/me', meResponseSchema),
    // Who's logged in rarely changes on its own; logging in/out updates it directly.
    staleTime: Infinity,
  });
}

/** Forget everything from the previous person, then remember the new one. */
function switchUser(queryClient: QueryClient, me: MeResponse) {
  queryClient.clear();
  queryClient.setQueryData(meKey, me);
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput) => apiSend('POST', '/api/auth/login', input, meResponseSchema),
    onSuccess: (me) => switchUser(queryClient, me),
  });
}

export function useSignup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SignupInput) =>
      apiSend('POST', '/api/auth/signup', input, meResponseSchema),
    onSuccess: (me) => switchUser(queryClient, me),
  });
}

export function useDemoLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiSend('POST', '/api/auth/demo', {}, meResponseSchema),
    onSuccess: (me) => switchUser(queryClient, me),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost('/api/auth/logout'),
    onSuccess: () => switchUser(queryClient, { user: null }),
  });
}
