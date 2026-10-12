// ============================================================================
// api/value.ts: WHAT THE COLLECTION IS WORTH, OVER TIME
//
//   useCollectionValue()   the total, the chart's points, each record's price
//   useRefreshPrices()     "Update prices now": look up prices that are due
//
// The key starts with 'records', so adding or deleting a record refreshes it.
// ============================================================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { collectionValueSchema, priceRefreshSchema } from '@vinyl/shared';
import { apiGet, apiSend } from './client';

export const valueKeys = {
  all: ['records', 'value'] as const,
};

export function useCollectionValue() {
  return useQuery({
    queryKey: valueKeys.all,
    queryFn: () => apiGet('/api/value', collectionValueSchema),
  });
}

export function useRefreshPrices() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiSend('POST', '/api/value/refresh', undefined, priceRefreshSchema),
    // New prices change the total, the chart and the list.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: valueKeys.all }),
  });
}
