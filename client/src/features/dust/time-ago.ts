// ============================================================================
// time-ago.ts: "4 MONTHS AGO" FROM A NUMBER OF DAYS
//
//   0 -> "today", 1 -> "yesterday", 10 -> "10 days ago", 30 -> "4 weeks ago",
//   120 -> "4 months ago", 800 -> "2 years ago"
// Intl.RelativeTimeFormat is the browser's built-in way to write these, in the
// viewer's own language.
// ============================================================================

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

export function formatDaysAgo(days: number): string {
  if (days < 14) return relative.format(-days, 'day');
  if (days < 60) return relative.format(-Math.floor(days / 7), 'week');
  if (days < 365) return relative.format(-Math.floor(days / 30), 'month');
  return relative.format(-Math.floor(days / 365), 'year');
}
