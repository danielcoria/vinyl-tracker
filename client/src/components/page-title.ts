// ============================================================================
// page-title.ts: THE BROWSER TAB'S TITLE FOR EACH PAGE
//
// "/diary" -> "Diary · Vinyl Tracker". With several tabs open (or in the
// browser's history), the title says which page each one is.
// ============================================================================

const APP = 'Vinyl Tracker';

/** Address beginnings and the page they belong to. The first match wins. */
const PAGES: [RegExp, string | ((match: RegExpMatchArray) => string)][] = [
  [/^\/$/, 'Collection'],
  [/^\/login$/, 'Log in'],
  [/^\/signup$/, 'Create an account'],
  [/^\/records\/new$/, 'Add a record'],
  [/^\/records\/\d+\/edit$/, 'Edit record'],
  [/^\/records\/\d+$/, 'Record'],
  [/^\/discogs$/, 'Add from Discogs'],
  [/^\/tonight$/, 'What should I play tonight?'],
  [/^\/diary$/, 'Diary'],
  [/^\/stats$/, 'Stats'],
  [/^\/value$/, 'Collection value'],
  [/^\/dust$/, 'Dust report'],
  [/^\/stylus$/, 'Stylus'],
  [/^\/streaming$/, 'Streaming vs. shelf'],
  [/^\/discover$/, 'Discover'],
  [/^\/wishlist$/, 'Wishlist'],
  [/^\/u\/([^/]+)\/year\/(\d+)$/, (m) => `@${m[1]}: ${m[2]} in records`],
  [/^\/u\/([^/]+)$/, (m) => `@${m[1]}`],
];

export function titleFor(pathname: string): string {
  for (const [pattern, page] of PAGES) {
    const match = pathname.match(pattern);
    if (match) return `${typeof page === 'string' ? page : page(match)} · ${APP}`;
  }
  return APP;
}
