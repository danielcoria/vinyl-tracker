// ============================================================================
// RatingSpread.tsx: HOW MANY RECORDS GOT EACH STAR RATING
//
// A row per rating, 5 stars at the top, with a bar and the count beside it.
// Covers the whole collection, whatever period the Stats page is showing.
// ============================================================================

import type { Stats } from '@vinyl/shared';
import { Stars } from './Stars';

export function RatingSpread({ ratings }: { ratings: Stats['ratings'] }) {
  const max = Math.max(...ratings.counts.map((c) => c.count), 1);
  // Highest rating first.
  const rows = [...ratings.counts].reverse();

  return (
    <section className="stats-card" aria-label="Your ratings">
      <div className="card-header">
        <h2>Your ratings</h2>
        <span className="muted">
          {ratings.ratedCount} rated
          {ratings.average !== null && ` · average ${ratings.average.toFixed(1)}`}
        </span>
      </div>
      <ol className="rating-spread">
        {rows.map(({ rating, count }) => (
          <li key={rating}>
            <Stars rating={rating} />
            {/* The bar only shows the size; the number beside it carries the value. */}
            <span
              className="ranked-bar"
              style={{ width: `calc((100% - 9rem) * ${count / max})` }}
              aria-hidden="true"
            />
            <span className="ranked-value">{count}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
