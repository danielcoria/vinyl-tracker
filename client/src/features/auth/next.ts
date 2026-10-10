// ============================================================================
// next.ts: WHERE TO GO AFTER LOGGING IN
//
// The login page remembers where you were going (?next=/stats). This makes sure
// that's a page on THIS site ("/stats"), never another website
// ("https://elsewhere" or "//elsewhere"), so a link can't trick someone into
// being sent somewhere else after they log in.
// ============================================================================

export function safeNext(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}
