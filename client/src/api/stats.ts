// ============================================================================
// api/stats.ts: THE HOOK FOR THE STATS PAGE
//
//   useStats(period)  numbers for "last 30 days", "this year" or "all time"
//
// The period is turned into exact start times in YOUR time zone (e.g. this
// year starts at midnight on January 1 where you are), and your time zone is
// sent along so plays are counted in the right month.
// ============================================================================

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { statsSchema } from '@vinyl/shared';
import { apiGet } from './client';

export const PERIODS = ['30d', 'year', 'all'] as const;
export type Period = (typeof PERIODS)[number];

export const PERIOD_LABELS: Record<Period, string> = {
  '30d': 'Last 30 days',
  year: 'This year',
  all: 'All time',
};

/** Where the period starts, as local midnight. Undefined = from the very beginning. */
export function periodStart(period: Period, now = new Date()): Date | undefined {
  if (period === 'all') return undefined;
  if (period === 'year') return new Date(now.getFullYear(), 0, 1);
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29); // today + 29 days before
}

export function useStats(period: Period) {
  return useQuery({
    queryKey: ['stats', period],
    queryFn: () => {
      const start = periodStart(period);
      const params = new URLSearchParams({
        // getTimezoneOffset() is "UTC minus local", so flip the sign.
        utcOffsetMinutes: String(-new Date().getTimezoneOffset()),
      });
      if (start) params.set('from', start.toISOString());
      return apiGet(`/api/stats?${params}`, statsSchema);
    },
    // While another period loads, keep showing the current numbers (faded).
    placeholderData: keepPreviousData,
  });
}
