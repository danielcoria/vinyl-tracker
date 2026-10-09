// ============================================================================
// api/styluses.ts: HOOKS FOR THE STYLUS WEAR TRACKER
//
//   useStyluses()        every stylus with its wear (the one in use is first)
//   useAddStylus()       install a new stylus
//   useUpdateStylus(id)  change name, rated hours or starting hours
//   useDeleteStylus()    remove one added by mistake
// ============================================================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { stylusListSchema, stylusSchema, type StylusInput, type StylusUpdate } from '@vinyl/shared';
import { apiDelete, apiGet, apiSend } from './client';

export const stylusKeys = { all: ['styluses'] as const };

export function useStyluses() {
  return useQuery({
    queryKey: stylusKeys.all,
    queryFn: async () => (await apiGet('/api/styluses', stylusListSchema)).styluses,
  });
}

/** The stylus in use now, if there is one. */
export function useActiveStylus() {
  const styluses = useStyluses();
  return styluses.data?.find((s) => s.retiredAt === null) ?? null;
}

export function useAddStylus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: StylusInput) => apiSend('POST', '/api/styluses', input, stylusSchema),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: stylusKeys.all }),
  });
}

export function useUpdateStylus(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (update: StylusUpdate) =>
      apiSend('PUT', `/api/styluses/${id}`, update, stylusSchema),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: stylusKeys.all }),
  });
}

export function useDeleteStylus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiDelete(`/api/styluses/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: stylusKeys.all }),
  });
}
