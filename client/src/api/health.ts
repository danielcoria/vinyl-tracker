// ============================================================================
// api/health.ts: ASK THE SERVER IF IT'S RUNNING
//
// This is a "hook": a function whose name starts with `use` that a React
// component can call to get data. Components call `useHealth()` and get back
// the current state of the request (loading / error / data).
// ============================================================================

import { useQuery } from '@tanstack/react-query';
import { healthResponseSchema } from '@vinyl/shared';
import { apiGet } from './client';

export function useHealth() {
  return useQuery({
    // A name for this piece of data. TanStack Query uses it to remember
    // (cache) the answer, so two components asking for it share one request.
    queryKey: ['health'],
    // How to actually get the data: call GET /api/health on our server and
    // check the answer has the shape described by healthResponseSchema.
    queryFn: () => apiGet('/api/health', healthResponseSchema),
  });
}
