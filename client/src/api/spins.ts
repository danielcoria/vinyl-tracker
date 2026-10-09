// ============================================================================
// api/spins.ts: HOOKS FOR TRACKLISTS AND THE LISTENING DIARY
//
//   useTracks(recordId)   a record's tracklist
//   useSpins(query)       logged plays, newest first (all, or one record's)
//   useLogSpin()          log a play
//   useDeleteSpin()       remove a play
// ============================================================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  spinListSchema,
  spinSchema,
  trackListSchema,
  type SpinInput,
  type SpinListQuery,
} from '@vinyl/shared';
import { apiDelete, apiGet, apiSend } from './client';

export const spinKeys = {
  all: ['spins'] as const,
  list: (query: SpinListQuery) => ['spins', 'list', query] as const,
  tracks: (recordId: number) => ['tracks', recordId] as const,
};

export function useTracks(recordId: number) {
  return useQuery({
    queryKey: spinKeys.tracks(recordId),
    queryFn: async () => (await apiGet(`/api/records/${recordId}/tracks`, trackListSchema)).tracks,
  });
}

export function useSpins(query: SpinListQuery) {
  return useQuery({
    queryKey: spinKeys.list(query),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (query.recordId) params.set('recordId', String(query.recordId));
      if (query.limit) params.set('limit', String(query.limit));
      return (await apiGet(`/api/spins?${params}`, spinListSchema)).spins;
    },
  });
}

export function useLogSpin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SpinInput) => apiSend('POST', '/api/spins', input, spinSchema),
    onSuccess: () => refreshAfterChange(queryClient),
  });
}

export function useDeleteSpin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (spinId: number) => apiDelete(`/api/spins/${spinId}`),
    onSuccess: () => refreshAfterChange(queryClient),
  });
}

/** Plays changed: refresh the diary, records (play counts), stats and stylus wear. */
function refreshAfterChange(queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: spinKeys.all }),
    queryClient.invalidateQueries({ queryKey: ['records'] }),
    queryClient.invalidateQueries({ queryKey: ['stats'] }),
    queryClient.invalidateQueries({ queryKey: ['styluses'] }),
  ]);
}
