// ============================================================================
// StarRating.tsx: PICK A STAR RATING BY CLICKING THE STARS
//
// Each star has two halves you can click: the left half gives a half star, the
// right half the full one. Underneath, it's ten ordinary radio buttons (0.5 to
// 5 stars) laid invisibly over the stars, so it also works with the keyboard
// (arrow keys) and screen readers. "Clear" removes the rating.
// ============================================================================

import { useId, useState } from 'react';
import { RATING_STEPS } from '@vinyl/shared';
import { starsLabel } from './format';
import { StarRow } from './Stars';

type Props = {
  /** What is being rated, e.g. "Your rating". Read out by screen readers. */
  label: string;
  value: number | null;
  onChange: (rating: number | null) => void;
  disabled?: boolean;
};

export function StarRating({ label, value, onChange, disabled = false }: Props) {
  // useId gives this group of radio buttons a name no other group on the page has.
  const name = useId();
  // The rating under the mouse, shown as a preview before clicking.
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div className="star-rating">
      <div className="stars stars-large star-input" role="radiogroup" aria-label={label}>
        <StarRow fill={hovered ?? value ?? 0} />
        <span className="star-hits">
          {RATING_STEPS.map((step) => (
            <label
              key={step}
              title={starsLabel(step)}
              onMouseEnter={() => setHovered(step)}
              onMouseLeave={() => setHovered(null)}
            >
              <input
                type="radio"
                className="visually-hidden"
                name={name}
                checked={value === step}
                disabled={disabled}
                onChange={() => onChange(step)}
              />
              <span className="visually-hidden">{starsLabel(step)}</span>
            </label>
          ))}
        </span>
      </div>
      {value !== null && (
        <button
          type="button"
          className="button button-small"
          disabled={disabled}
          onClick={() => onChange(null)}
        >
          Clear
        </button>
      )}
    </div>
  );
}
