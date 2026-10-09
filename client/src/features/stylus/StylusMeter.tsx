// ============================================================================
// StylusMeter.tsx: THE WEAR METER
//
//   ⚠ Replace soon                              412 of 500 h · 82%
//   [██████████████████████████████░░░░░░░]
//
// The fill's color follows the status (blue → amber → red), the track behind it
// is a pale version of the same color, and the status is always written out too.
// ============================================================================

import type { Stylus } from '@vinyl/shared';
import { formatStylusHours, STATUS_DISPLAY } from './status';

export function StylusMeter({ stylus }: { stylus: Stylus }) {
  const { icon, label } = STATUS_DISPLAY[stylus.status];

  return (
    <div className={`stylus-meter status-${stylus.status}`}>
      <div className="stylus-meter-labels">
        <span className="status-label">
          <span aria-hidden="true">{icon}</span> {label}
        </span>
        <span>
          <strong>{formatStylusHours(stylus.hoursUsed)}</strong>
          <span className="muted">
            {' '}
            of {stylus.ratedHours.toLocaleString()} h · {stylus.percentUsed}%
          </span>
        </span>
      </div>
      <div
        className="meter-track"
        role="meter"
        aria-label="Stylus wear"
        aria-valuemin={0}
        aria-valuemax={100}
        // Past 100% the bar stays full; the words say how far over it is.
        aria-valuenow={Math.min(stylus.percentUsed, 100)}
        aria-valuetext={`${stylus.percentUsed}% of rated hours used. ${label}.`}
      >
        <div className="meter-fill" style={{ width: `${Math.min(stylus.percentUsed, 100)}%` }} />
      </div>
    </div>
  );
}
