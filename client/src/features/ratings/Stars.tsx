// ============================================================================
// Stars.tsx: SHOWS A STAR RATING (read-only)
//
// Five grey stars with the same five in color laid on top, cut off at the
// rating: 3.5 stars shows 70% of the colored row, which is three and a half.
// Screen readers hear "3.5 stars" instead of ten star characters.
// ============================================================================

import { starsLabel } from './format';

type Props = {
  rating: number;
  /** "large" for the rating you can click on a record's page. */
  size?: 'small' | 'large';
};

export function Stars({ rating, size = 'small' }: Props) {
  return (
    <span className={`stars stars-${size}`} role="img" aria-label={starsLabel(rating)}>
      <StarRow fill={rating} />
    </span>
  );
}

/** The two rows of stars. `fill` is how many stars are colored (0 to 5). */
export function StarRow({ fill }: { fill: number }) {
  return (
    <span className="star-row" aria-hidden="true">
      ★★★★★
      <span className="star-row-fill" style={{ width: `${(fill / 5) * 100}%` }}>
        ★★★★★
      </span>
    </span>
  );
}
