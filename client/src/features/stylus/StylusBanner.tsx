// ============================================================================
// StylusBanner.tsx: THE WARNING ACROSS THE TOP WHEN THE STYLUS IS WORN
//
// Shown on every page (except the Stylus page itself, which says it already)
// once the stylus in use reaches 75% of its rated hours.
//
// The × hides it until the site is opened again (a new tab or window). It's
// remembered in sessionStorage: the browser's storage that lasts while the tab
// is open, through reloads, and is cleared when the tab closes.
// If things get worse (from "replace soon" to "time to replace") or a different
// stylus is installed, the warning comes back, because that's news.
// ============================================================================

import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { useActiveStylus } from '../../api/styluses';
import { STATUS_DISPLAY } from './status';

const STORAGE_KEY = 'vinyl-tracker:stylus-banner-dismissed';

/** What was dismissed: this stylus at this status, e.g. "3:soon". */
function readDismissed(): string | null {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null; // storage blocked (e.g. some private modes): just show the banner
  }
}

function saveDismissed(value: string) {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Can't remember it; it'll stay hidden until the page is reloaded.
  }
}

export function StylusBanner() {
  const stylus = useActiveStylus();
  const { pathname } = useLocation();
  const [dismissed, setDismissed] = useState(readDismissed);

  if (!stylus || stylus.status === 'ok' || pathname === '/stylus') return null;

  const current = `${stylus.id}:${stylus.status}`;
  if (dismissed === current) return null;

  function dismiss() {
    saveDismissed(current);
    setDismissed(current);
  }

  const { icon } = STATUS_DISPLAY[stylus.status];
  const message =
    stylus.status === 'replace'
      ? `Your stylus is past its rated hours (${stylus.percentUsed}%). A worn stylus can damage records.`
      : `Your stylus has used ${stylus.percentUsed}% of its rated hours. Time to plan a replacement.`;

  return (
    <div className={`stylus-banner status-${stylus.status}`} role="status">
      <span aria-hidden="true">{icon}</span>
      <span>{message}</span>
      <Link to="/stylus">Stylus details</Link>
      <button
        type="button"
        className="banner-close"
        aria-label="Hide this warning"
        title="Hide until you open the site again"
        onClick={dismiss}
      >
        ×
      </button>
    </div>
  );
}
