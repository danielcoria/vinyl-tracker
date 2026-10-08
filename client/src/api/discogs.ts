// ============================================================================
// api/discogs.ts: HOOKS FOR SEARCHING AND IMPORTING FROM DISCOGS
//
//   useDiscogsSearch(q, page)  search results (only runs when there's a search)
//   useImportRelease()         add a Discogs release as a new record
//   useLinkRecord()            fill in an existing record from a Discogs release
//
// These only talk to OUR server. The server talks to Discogs, so the token
// never reaches the browser.
// ============================================================================

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  discogsSearchResponseSchema,
  recordSchema,
  type DiscogsLinkInput,
  type VinylRecord,
} from '@vinyl/shared';
import { apiGet, apiSend } from './client';
import { recordKeys } from './records';

export const discogsKeys = {
  search: (q: string, page: number) => ['discogs', 'search', q, page] as const,
};

export function useDiscogsSearch(q: string, page: number) {
  return useQuery({
    queryKey: discogsKeys.search(q, page),
    queryFn: () => {
      const params = new URLSearchParams({ q, page: String(page) });
      return apiGet(`/api/discogs/search?${params}`, discogsSearchResponseSchema);
    },
    // Don't ask the server until there's something to search for.
    enabled: q.trim() !== '',
    placeholderData: keepPreviousData,
  });
}

export function useImportRelease() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (releaseId: number) =>
      apiSend('POST', '/api/discogs/import', { releaseId }, recordSchema),
    onSuccess: (record) => refreshAfterChange(queryClient, record),
  });
}

export function useLinkRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: DiscogsLinkInput) =>
      apiSend('POST', '/api/discogs/link', input, recordSchema),
    onSuccess: (record) => refreshAfterChange(queryClient, record),
  });
}

/**
 * After an import or link: remember the saved record, and mark the record lists
 * and search results as out of date (so "In your collection" shows up).
 */
function refreshAfterChange(queryClient: ReturnType<typeof useQueryClient>, record: VinylRecord) {
  queryClient.setQueryData(recordKeys.detail(record.id), record);
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ['records', 'list'] }),
    queryClient.invalidateQueries({ queryKey: ['discogs', 'search'] }),
  ]);
}
