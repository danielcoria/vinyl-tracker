// ============================================================================
// chart-colors.ts: COLORS FOR THE GENRE CHART
//
// Five genre colors, chosen and checked (with a colorblind-safety checker)
// to stay tell-apart-able for people with color blindness, in both light and
// dark mode. "Other" is always a neutral gray, so it never looks like a genre.
//
// Two rules:
//   - Colors are given out in a fixed order, never made up on the spot.
//   - A genre KEEPS its color while the page is open, even when you switch
//     periods and the ranking changes (useStableSlots). Otherwise "Jazz is
//     blue" would suddenly mean something else.
// ============================================================================

import { useState, useSyncExternalStore } from 'react';

const SERIES = {
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4'],
  dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181'],
};

/** The chart's own neutrals (gridlines, axis, "Other", the gap between stacked parts). */
const CHROME = {
  light: {
    surface: '#ffffff',
    grid: '#e1e0d9',
    axis: '#898781',
    other: '#a8a69e',
    hover: 'rgba(11,11,11,0.05)',
  },
  dark: {
    surface: '#1f1b17',
    grid: '#2c2c2a',
    axis: '#898781',
    other: '#6b6a64',
    hover: 'rgba(255,255,255,0.06)',
  },
};

export const OTHER = 'Other';
export const SLOT_COUNT = SERIES.light.length;

export type Scheme = 'light' | 'dark';

const DARK_QUERY = '(prefers-color-scheme: dark)';
const canMatchMedia = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function';

/** "light" or "dark", following the computer's setting (and updating if it changes). */
export function useColorScheme(): Scheme {
  return useSyncExternalStore(
    (onChange) => {
      if (!canMatchMedia()) return () => {};
      const media = window.matchMedia(DARK_QUERY);
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    },
    () => (canMatchMedia() && window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light'),
    () => 'light',
  );
}

export function chartColors(scheme: Scheme) {
  return { series: SERIES[scheme], ...CHROME[scheme] };
}

/**
 * Which color slot (0-4) each genre uses. Genres seen before keep their slot;
 * new ones take the first free slot. ("Other" isn't given a slot: it's gray.)
 */
export function useStableSlots(names: string[]): Map<string, number> {
  const [slots, setSlots] = useState(() => assignSlots(new Map(), names));
  const next = assignSlots(slots, names);
  // Updating state while drawing is React's way to adjust to new data; it only
  // happens when a genre appears that has no color yet.
  if (next !== slots) setSlots(next);
  return next;
}

/** Returns `previous` unchanged when every genre already has a slot. */
export function assignSlots(previous: Map<string, number>, names: string[]): Map<string, number> {
  const genres = names.filter((name) => name !== OTHER);
  if (genres.every((name) => previous.has(name))) return previous;

  // Keep the slots of genres still on screen; free up the rest.
  const next = new Map<string, number>();
  for (const name of genres) {
    const slot = previous.get(name);
    if (slot !== undefined) next.set(name, slot);
  }
  const used = new Set(next.values());
  for (const name of genres) {
    if (next.has(name)) continue;
    const free = [...Array(SLOT_COUNT).keys()].find((slot) => !used.has(slot)) ?? 0;
    next.set(name, free);
    used.add(free);
  }
  return next;
}
