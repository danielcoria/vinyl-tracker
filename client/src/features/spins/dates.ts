// ============================================================================
// dates.ts: SHOWING DATES AND TIMES IN THE DIARY
//
// The server stores times in UTC (e.g. "2026-10-06T19:30:00.000Z"). These turn
// them into your local time, like "7:30 PM" or "Monday, October 6".
// ============================================================================

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** "Monday, October 6" (with the year added if it isn't this year). */
export function formatDay(iso: string): string {
  const date = new Date(iso);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: sameYear ? undefined : 'numeric',
  });
}

/** "Oct 6, 2026" */
export function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** A key that's the same for every time on the same local day (for grouping). */
export function localDayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/**
 * The value a <input type="datetime-local"> expects, in local time:
 * "2026-10-06T19:30".
 */
export function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}
