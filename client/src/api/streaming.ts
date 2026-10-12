// ============================================================================
// api/streaming.ts: STREAMING VS. SHELF, PRICES AND THE WISHLIST
//
//   useStreaming(period, enabled)   most-streamed albums vs. the shelf
//   useVinylPrice(album, enabled)   the cheapest vinyl copy on Discogs
//   useWishlist()                   the wishlist
//   useAddToWishlist() / useRemoveFromWishlist()
//
// The streaming key starts with 'records', so adding or deleting a record also
// refreshes which albums count as "on your shelf".
// ============================================================================

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  streamingSchema,
  vinylPriceSchema,
  wishlistItemSchema,
  wishlistSchema,
  type StreamingPeriod,
  type WishlistInput,
} from '@vinyl/shared';
import { apiDelete, apiGet, apiSend } from './client';

export const streamingKeys = {
  all: ['records', 'streaming'] as const,
  period: (period: StreamingPeriod) => ['records', 'streaming', period] as const,
  wishlist: ['wishlist'] as const,
};

export function useStreaming(period: StreamingPeriod, enabled: boolean) {
  return useQuery({
    queryKey: streamingKeys.period(period),
    queryFn: () => apiGet(`/api/streaming?${new URLSearchParams({ period })}`, streamingSchema),
    // Not asked until a Last.fm username is saved.
    enabled,
    // While another period loads, keep showing the current list (faded).
    placeholderData: keepPreviousData,
    // "No such user" won't fix itself, so don't ask again automatically.
    retry: false,
  });
}

export function useVinylPrice(album: { artist: string; title: string }, enabled: boolean) {
  return useQuery({
    queryKey: ['price', album.artist, album.title],
    queryFn: () => apiGet(`/api/streaming/price?${new URLSearchParams(album)}`, vinylPriceSchema),
    enabled,
    // Prices don't change by the minute; don't ask Discogs again for an hour.
    staleTime: 60 * 60 * 1000,
    retry: false,
  });
}

export function useWishlist() {
  return useQuery({
    queryKey: streamingKeys.wishlist,
    queryFn: async () => (await apiGet('/api/wishlist', wishlistSchema)).items,
  });
}

/** After the wishlist changes: refresh it, and the "on your wishlist" marks. */
function refresh(queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: streamingKeys.wishlist }),
    queryClient.invalidateQueries({ queryKey: streamingKeys.all }),
  ]);
}

export function useAddToWishlist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: WishlistInput) =>
      apiSend('POST', '/api/wishlist', input, wishlistItemSchema),
    onSuccess: () => refresh(queryClient),
  });
}

export function useRemoveFromWishlist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiDelete(`/api/wishlist/${id}`),
    onSuccess: () => refresh(queryClient),
  });
}
