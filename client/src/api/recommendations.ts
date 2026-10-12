// ============================================================================
// api/recommendations.ts: ALBUMS TO CONSIDER, BASED ON THE SHELF
//
//   useRecommendations()   albums by artists similar to the ones you own
//
// The key starts with 'records', so adding or deleting a record refreshes the
// suggestions (they're based on the shelf).
// ============================================================================

import { useQuery } from '@tanstack/react-query';
import { recommendationsSchema } from '@vinyl/shared';
import { apiGet } from './client';

export const recommendationKeys = {
  all: ['records', 'recommendations'] as const,
};

export function useRecommendations() {
  return useQuery({
    queryKey: recommendationKeys.all,
    queryFn: () => apiGet('/api/recommendations', recommendationsSchema),
    // Suggestions don't change from minute to minute.
    staleTime: 10 * 60 * 1000,
    // "Last.fm isn't set up" won't fix itself, so don't ask again automatically.
    retry: false,
  });
}
