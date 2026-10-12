// ============================================================================
// format.ts (streaming): WORDS AND NUMBERS FOR STREAMING VS. SHELF
// ============================================================================

/**
 * "$24.99", "€18.50"... written the way the visitor's own country writes money.
 * `whole` drops the cents ("$480"), for chart axes.
 */
export function formatPrice(value: number, currency: string, whole = false): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: whole ? 0 : 2,
      minimumFractionDigits: whole ? 0 : 2,
    }).format(value);
  } catch {
    // An unknown currency code: show it as plain text instead of failing.
    return `${value.toFixed(2)} ${currency}`;
  }
}

/** "Streamed 412 times", "Streamed once". */
export function formatStreams(count: number): string {
  if (count === 1) return 'Streamed once';
  return `Streamed ${count.toLocaleString()} times`;
}

/** "A", "A and B", "A, B and C": a list written the way the visitor's language writes it. */
export function formatList(names: string[]): string {
  return new Intl.ListFormat(undefined, { style: 'long', type: 'conjunction' }).format(names);
}

/** The Discogs search page of this app, already filled in with the album. */
export function findOnDiscogsUrl(album: { artist: string; title: string }): string {
  return `/discogs?${new URLSearchParams({ q: `${album.artist} ${album.title}` })}`;
}
