// ============================================================================
// api/scrobbling.ts: SENDING VINYL PLAYS TO LAST.FM
//
//   useScrobblingStatus()     is scrobbling available, and is Last.fm connected?
//   useDisconnectLastfm()     disconnect
//   LASTFM_CONNECT_URL        where the browser goes to connect
//
// Connecting isn't a request made by this code: the browser itself visits
// LASTFM_CONNECT_URL, the server sends it on to Last.fm to approve the app,
// and Last.fm sends it back (see server/src/routes/lastfm.ts).
// ============================================================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { scrobblingStatusSchema } from '@vinyl/shared';
import { apiDelete, apiGet } from './client';

export const LASTFM_CONNECT_URL = '/api/lastfm/connect';

export const scrobblingKeys = {
  status: ['lastfm', 'status'] as const,
};

export function useScrobblingStatus() {
  return useQuery({
    queryKey: scrobblingKeys.status,
    queryFn: () => apiGet('/api/lastfm/status', scrobblingStatusSchema),
  });
}

export function useDisconnectLastfm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiDelete('/api/lastfm/connection'),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: scrobblingKeys.status }),
        // Plays that were waiting to be sent no longer are.
        queryClient.invalidateQueries({ queryKey: ['spins'] }),
      ]),
  });
}
