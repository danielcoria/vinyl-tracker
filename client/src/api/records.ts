// ============================================================================
// api/records.ts: HOOKS FOR READING AND CHANGING RECORDS
//
// Screens call these instead of talking to the server directly:
//   useRecords(query)   the list of records (with search/sort)
//   useRecord(id)       one record
//   useCreateRecord()   add a record
//   useUpdateRecord(id) save changes to a record
//   useDeleteRecord()   delete a record
//
// TanStack Query remembers ("caches") answers by their queryKey. After a change
// we tell it which remembered answers are now out of date ("invalidate"), and
// it re-fetches them, so every screen stays in sync without extra code.
// ============================================================================

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  recordListSchema,
  recordSchema,
  type RecordInput,
  type RecordListQuery,
  type VinylRecord,
} from '@vinyl/shared';
import { apiDelete, apiGet, apiSend } from './client';

/** Cache keys. Everything starts with 'records', so one invalidate refreshes them all. */
export const recordKeys = {
  all: ['records'] as const,
  list: (query: RecordListQuery) => ['records', 'list', query] as const,
  detail: (id: number) => ['records', 'detail', id] as const,
};

export function useRecords(query: RecordListQuery) {
  return useQuery({
    queryKey: recordKeys.list(query),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (query.q) params.set('q', query.q);
      if (query.sort) params.set('sort', query.sort);
      const search = params.size > 0 ? `?${params}` : '';
      return (await apiGet(`/api/records${search}`, recordListSchema)).records;
    },
    // While a new search loads, keep showing the old results instead of a blank screen.
    placeholderData: keepPreviousData,
  });
}

export function useRecord(id: number) {
  return useQuery({
    queryKey: recordKeys.detail(id),
    queryFn: () => apiGet(`/api/records/${id}`, recordSchema),
  });
}

/** A "mutation" is a request that changes data. Call `.mutate(input)` to run it. */
export function useCreateRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RecordInput) => apiSend('POST', '/api/records', input, recordSchema),
    onSuccess: (record) => afterChange(queryClient, record),
  });
}

export function useUpdateRecord(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RecordInput) => apiSend('PUT', `/api/records/${id}`, input, recordSchema),
    onSuccess: (record) => afterChange(queryClient, record),
  });
}

export function useDeleteRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiDelete(`/api/records/${id}`),
    onSuccess: (_result, id) => {
      // Forget the deleted record, then refresh the lists.
      queryClient.removeQueries({ queryKey: recordKeys.detail(id) });
      return queryClient.invalidateQueries({ queryKey: recordKeys.all });
    },
  });
}

/** After saving: remember the fresh record and mark the record lists as out of date. */
function afterChange(queryClient: ReturnType<typeof useQueryClient>, record: VinylRecord) {
  queryClient.setQueryData(recordKeys.detail(record.id), record);
  return queryClient.invalidateQueries({ queryKey: ['records', 'list'] });
}
