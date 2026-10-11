// ============================================================================
// year.ts: SMALL HELPERS FOR THE "YEAR IN RECORDS" PAGE
// ============================================================================

import type { YearInRecords } from '@vinyl/shared';

type Months = YearInRecords['months'];

/** The month with the most listening (the earliest one if tied), or null if none. */
export function busiestMonth(months: Months): Months[number] | null {
  return months.reduce<Months[number] | null>(
    (best, m) => (m.listeningSeconds > (best?.listeningSeconds ?? 0) ? m : best),
    null,
  );
}
