// ============================================================================
// Reviews.tsx: HIGHEST-RATED RECORDS AND WRITTEN REVIEWS ON A PROFILE
// ============================================================================

import type { Profile } from '@vinyl/shared';
import { formatArtists } from '../collection/format';
import { RecordCover } from '../collection/RecordCover';
import { Stars } from '../ratings/Stars';
import { formatShortDate } from '../spins/dates';

export function HighestRated({ records }: { records: Profile['highestRated'] }) {
  if (records.length === 0) return null;
  return (
    <section className="profile-section" aria-label="Highest rated">
      <h2>Highest rated</h2>
      <ul className="record-grid record-grid-small">
        {records.map(({ record, rating }) => (
          <li key={record.id} className="record-card">
            <RecordCover record={record} />
            <span className="record-card-title">{record.title}</span>
            <span className="record-card-artist">{formatArtists(record.artists)}</span>
            <Stars rating={rating} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Reviews({ reviews }: { reviews: Profile['reviews'] }) {
  if (reviews.length === 0) return null;
  return (
    <section className="profile-section" aria-label="Reviews">
      <h2>Reviews</h2>
      <ul className="review-list">
        {reviews.map(({ record, rating, review, reviewedAt }) => (
          <li key={record.id} className="review">
            <span className="review-cover">
              <RecordCover record={record} />
            </span>
            <div className="review-body">
              <span className="spin-title">{record.title}</span>
              <span className="muted">
                {formatArtists(record.artists)} · {formatShortDate(reviewedAt)}
              </span>
              {rating !== null && <Stars rating={rating} />}
              <p className="review-text">{review}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
