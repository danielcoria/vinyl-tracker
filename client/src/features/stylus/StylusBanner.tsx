// ============================================================================
// StylusBanner.tsx: THE WARNING ACROSS THE TOP WHEN THE STYLUS IS WORN
//
// Shown on every page (except the Stylus page itself, which says it already)
// once the stylus in use reaches 75% of its rated hours.
// ============================================================================

import { Link, useLocation } from 'react-router';
import { useActiveStylus } from '../../api/styluses';
import { STATUS_DISPLAY } from './status';

export function StylusBanner() {
  const stylus = useActiveStylus();
  const { pathname } = useLocation();
  if (!stylus || stylus.status === 'ok' || pathname === '/stylus') return null;

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
    </div>
  );
}
