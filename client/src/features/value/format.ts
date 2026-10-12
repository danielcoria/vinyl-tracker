// ============================================================================
// format.ts (value): DATES AND CHANGES FOR THE COLLECTION VALUE PAGE
// ============================================================================

import { formatPrice } from '../streaming/format';

/** "2026-10-12" -> "Oct 12", or "Oct 12, 2026" with the year. */
export function formatDay(date: string, withYear = false): string {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: withYear ? 'numeric' : undefined,
  });
}

/** "up $6.00", "down $2.50" or "no change": words, so it doesn't rely on color or arrows. */
export function formatChange(amount: number, currency: string): string {
  if (Math.abs(amount) < 0.005) return 'no change';
  return `${amount > 0 ? 'up' : 'down'} ${formatPrice(Math.abs(amount), currency)}`;
}

/** 0.153 -> "15%". */
export function formatPercent(ratio: number): string {
  return `${Math.round(Math.abs(ratio) * 100)}%`;
}
