// ============================================================================
// status.ts: HOW EACH STYLUS STATUS IS SHOWN
//
// Every status has an icon AND words, never just a color, so it's clear to
// everyone (including people who can't tell the colors apart).
// ============================================================================

import type { StylusStatus } from '@vinyl/shared';

export const STATUS_DISPLAY: Record<StylusStatus, { icon: string; label: string }> = {
  ok: { icon: '✓', label: 'Good' },
  soon: { icon: '⚠', label: 'Replace soon' },
  replace: { icon: '⛔', label: 'Time to replace' },
};

/** "12.5 h", "60 h" (no ".0"), and whole hours from 100 up ("123 h"). */
export function formatStylusHours(hours: number): string {
  if (hours >= 100) return `${Math.round(hours).toLocaleString()} h`;
  const rounded = Math.round(hours * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)} h`;
}
