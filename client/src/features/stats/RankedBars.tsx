// ============================================================================
// RankedBars.tsx: A TOP-10 LIST WITH BARS (most-listened artists or records)
//
//   1  Kendrick Lamar   ████████████████  1 h 15 min · 2 plays
//   2  Miles Davis      ███████████       1 h 05 min · 3 plays
//
// Each bar's length is its listening time compared to the #1 entry. The
// numbers are written next to every bar, so nothing depends on color alone.
// ============================================================================

import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { formatListening, formatPlays } from './format';

export type RankedItem = {
  key: string | number;
  label: string;
  sublabel?: string;
  href?: string;
  /** Shown before the label, e.g. a small cover. */
  leading?: ReactNode;
  listeningSeconds: number;
  spinCount: number;
};

export function RankedBars({ title, items }: { title: string; items: RankedItem[] }) {
  const max = Math.max(...items.map((item) => item.listeningSeconds), 1);

  return (
    <section className="stats-card" aria-label={title}>
      <h2>{title}</h2>
      <ol className="ranked-bars">
        {items.map((item, index) => (
          <li key={item.key}>
            <span className="rank">{index + 1}</span>
            {item.leading}
            <div className="ranked-main">
              <div className="ranked-label">
                {item.href ? <Link to={item.href}>{item.label}</Link> : <span>{item.label}</span>}
                {item.sublabel && <span className="muted"> · {item.sublabel}</span>}
              </div>
              <div className="ranked-bar-row">
                {/* The bar only shows the size; the numbers beside it carry the value. */}
                {/* The longest bar fills the row minus room for the numbers (10rem), so
                    every number sits right at the end of its bar and always fits. */}
                <span
                  className="ranked-bar"
                  style={{ width: `calc((100% - 10rem) * ${item.listeningSeconds / max})` }}
                  aria-hidden="true"
                />
                <span className="ranked-value">
                  {formatListening(item.listeningSeconds)}
                  <span className="muted"> · {formatPlays(item.spinCount)}</span>
                </span>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
