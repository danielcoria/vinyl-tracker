// ============================================================================
// api/suggestions.ts: "WHAT SHOULD I PLAY TONIGHT?"
//
//   useSuggestions(ask)   up to three picks for a time, genre and mood,
//                         leaving out the records in `exclude` (for Shuffle)
//
// The key deliberately does NOT start with 'records': logging a play from a
// suggestion shouldn't make the three picks jump around while you look at them.
// ============================================================================

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { suggestionsSchema, type SuggestionMood } from '@vinyl/shared';
import { apiGet } from './client';

export type Ask = {
  /** Minutes available; null = no limit. */
  minutes: number | null;
  /** null = any genre. */
  genre: string | null;
  mood: SuggestionMood;
  /** Records already shown, to leave out. */
  exclude: number[];
};

export function useSuggestions(ask: Ask) {
  return useQuery({
    queryKey: ['suggestions', ask],
    queryFn: () => {
      const params = new URLSearchParams({ mood: ask.mood });
      if (ask.minutes !== null) params.set('minutes', String(ask.minutes));
      if (ask.genre !== null) params.set('genre', ask.genre);
      if (ask.exclude.length > 0) params.set('exclude', ask.exclude.join(','));
      return apiGet(`/api/suggestions?${params}`, suggestionsSchema);
    },
    // While new picks load, keep showing the current ones (faded).
    placeholderData: keepPreviousData,
  });
}
