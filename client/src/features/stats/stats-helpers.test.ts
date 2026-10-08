// ============================================================================
// stats-helpers.test.ts: TESTS FOR STATS FORMATTING, PERIODS AND CHART COLORS
// ============================================================================

import { describe, expect, it } from 'vitest';
import { periodStart } from '../../api/stats';
import { assignSlots } from './chart-colors';
import { formatHours, formatListening, formatMonth } from './format';

describe('formatting', () => {
  it('shows big totals in hours, small ones in minutes', () => {
    expect(formatHours(45_000)).toBe('12.5 h');
    expect(formatHours(900)).toBe('15 min');
    expect(formatHours(500 * 3600)).toBe('500 h');
  });

  it('shows listening time as hours and minutes', () => {
    expect(formatListening(4500)).toBe('1 h 15 min');
    expect(formatListening(3900)).toBe('1 h 05 min');
    expect(formatListening(600)).toBe('10 min');
  });

  it('names months', () => {
    expect(formatMonth('2026-10')).toMatch(/Oct/);
    expect(formatMonth('2027-01', true)).toMatch(/Jan.*2027/);
  });
});

describe('periodStart', () => {
  const now = new Date(2026, 9, 8, 15, 30); // Oct 8, 3:30 PM local

  it('starts "this year" at local midnight on January 1', () => {
    expect(periodStart('year', now)).toEqual(new Date(2026, 0, 1));
  });

  it('starts "last 30 days" at midnight 29 days before today', () => {
    expect(periodStart('30d', now)).toEqual(new Date(2026, 8, 9));
  });

  it('has no start for all time', () => {
    expect(periodStart('all', now)).toBeUndefined();
  });
});

describe('assignSlots (chart colors)', () => {
  it('gives each genre its own color in order', () => {
    const slots = assignSlots(new Map(), ['Jazz', 'Rock', 'Other']);
    expect([...slots]).toEqual([
      ['Jazz', 0],
      ['Rock', 1],
    ]);
  });

  it('keeps each genre’s color when the ranking changes', () => {
    const first = assignSlots(new Map(), ['Jazz', 'Rock']);
    const second = assignSlots(first, ['Rock', 'Jazz']);
    expect(second).toBe(first); // nothing new, so nothing changes
  });

  it('gives new genres a free color without repainting the others', () => {
    const first = assignSlots(new Map(), ['Jazz', 'Rock', 'Soul']);
    // Rock dropped out, Folk came in: Folk takes Rock's free color, the rest stay.
    const second = assignSlots(first, ['Soul', 'Folk', 'Jazz']);
    expect(second.get('Jazz')).toBe(0);
    expect(second.get('Soul')).toBe(2);
    expect(second.get('Folk')).toBe(1);
  });
});
