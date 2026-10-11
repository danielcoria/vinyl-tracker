// ============================================================================
// api/profiles.ts: PUBLIC PROFILES
//
//   useProfile(username)              /u/username: shelf, most-played, years
//   useYearInRecords(username, year)  /u/username/year/2026: one year's recap
//   profileUrl(username)              the full shareable address
//
// The keys start with 'records', so logging a play or changing a record also
// refreshes your own profile.
// ============================================================================

import { useQuery } from '@tanstack/react-query';
import { profileSchema, yearInRecordsSchema } from '@vinyl/shared';
import { apiGet } from './client';

export const profileKeys = {
  all: ['records', 'profile'] as const,
  profile: (username: string) => ['records', 'profile', username] as const,
  year: (username: string, year: number) => ['records', 'profile', username, year] as const,
};

/** The viewer's time zone, so plays count in the right year. */
const zone = () =>
  // getTimezoneOffset() is "UTC minus local", so flip the sign.
  new URLSearchParams({ utcOffsetMinutes: String(-new Date().getTimezoneOffset()) });

export function useProfile(username: string) {
  return useQuery({
    queryKey: profileKeys.profile(username),
    queryFn: () => apiGet(`/api/profiles/${encodeURIComponent(username)}?${zone()}`, profileSchema),
  });
}

export function useYearInRecords(username: string, year: number) {
  return useQuery({
    queryKey: profileKeys.year(username, year),
    queryFn: () =>
      apiGet(
        `/api/profiles/${encodeURIComponent(username)}/years/${year}?${zone()}`,
        yearInRecordsSchema,
      ),
  });
}

export function profileUrl(username: string): string {
  return `${window.location.origin}/u/${username}`;
}
