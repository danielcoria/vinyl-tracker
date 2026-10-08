// ============================================================================
// format.ts (stats): NUMBERS AS WORDS FOR THE STATS PAGE
//
//   formatHours(45000)    -> "12.5 h"
//   formatListening(5400) -> "1 h 30 min",  formatListening(900) -> "15 min"
//   formatMonth("2026-10") -> "Oct"  (or "Oct 2026" when asked for the year)
// ============================================================================

/** Big totals: hours with one decimal ("12.5 h"); under an hour, minutes. */
export function formatHours(seconds: number): string {
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  const hours = seconds / 3600;
  return `${hours >= 100 ? Math.round(hours).toLocaleString() : hours.toFixed(1)} h`;
}

/** Listening time next to a bar: "2 h 05 min", "45 min". */
export function formatListening(seconds: number): string {
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  return `${hours} h ${String(minutes).padStart(2, '0')} min`;
}

export function formatPlays(count: number): string {
  return `${count.toLocaleString()} ${count === 1 ? 'play' : 'plays'}`;
}

/** "2026-10" -> "Oct", or "Oct 2026" with the year. */
export function formatMonth(month: string, withYear = false): string {
  const [year, monthNumber] = month.split('-').map(Number) as [number, number];
  return new Date(year, monthNumber - 1, 1).toLocaleDateString(undefined, {
    month: 'short',
    year: withYear ? 'numeric' : undefined,
  });
}
