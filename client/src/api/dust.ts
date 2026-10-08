// ============================================================================
// api/dust.ts: HOOKS FOR THE DUST REPORT AND SETTINGS
//
//   useDustReport()       records gathering dust and never played
//   useSettings()         the app's settings
//   useUpdateSettings()   change settings (e.g. how many days counts as dusty)
//
// The dust report's key starts with 'records', so anything that refreshes
// records (logging a play, adding or deleting a record) refreshes it too.
// ============================================================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { dustReportSchema, settingsSchema, type SettingsUpdate } from '@vinyl/shared';
import { apiGet, apiSend } from './client';

export const dustKeys = {
  report: ['records', 'dust'] as const,
  settings: ['settings'] as const,
};

export function useDustReport() {
  return useQuery({
    queryKey: dustKeys.report,
    queryFn: () => apiGet('/api/dust', dustReportSchema),
  });
}

export function useSettings() {
  return useQuery({
    queryKey: dustKeys.settings,
    queryFn: () => apiGet('/api/settings', settingsSchema),
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (update: SettingsUpdate) => apiSend('PUT', '/api/settings', update, settingsSchema),
    onSuccess: (saved) => {
      queryClient.setQueryData(dustKeys.settings, saved);
      // A new threshold changes which records count as dusty.
      return queryClient.invalidateQueries({ queryKey: dustKeys.report });
    },
  });
}
