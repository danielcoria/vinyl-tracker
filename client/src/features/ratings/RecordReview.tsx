// ============================================================================
// RecordReview.tsx: RATE AND REVIEW A RECORD (on its page)
//
// Clicking the stars saves the rating straight away. The review is written in
// a box that opens with "Write a review" and is saved with its own button.
// Reviews appear on the public profile (when it's turned on); notes never do.
// ============================================================================

import { useId, useState, type FormEvent } from 'react';
import { REVIEW_MAX_LENGTH, type VinylRecord } from '@vinyl/shared';
import { describeError } from '../../api/client';
import { useSetReview } from '../../api/records';
import { StarRating } from './StarRating';

export function RecordReview({ record }: { record: VinylRecord }) {
  const id = useId();
  const setReview = useSetReview(record.id);
  // null = not editing; otherwise the text being typed.
  const [draft, setDraft] = useState<string | null>(null);
  // While a new rating is being saved, show it straight away.
  const rating =
    setReview.isPending && setReview.variables.rating !== undefined
      ? setReview.variables.rating
      : record.rating;

  function saveReview(event: FormEvent) {
    event.preventDefault();
    setReview.mutate({ rating: record.rating, review: draft }, { onSuccess: () => setDraft(null) });
  }

  return (
    <section className="record-review" aria-label="Rating and review">
      <h2>Your rating</h2>
      <StarRating
        label="Your rating"
        value={rating}
        disabled={setReview.isPending}
        onChange={(next) => setReview.mutate({ rating: next, review: record.review })}
      />

      {draft === null ? (
        <>
          {record.review && <p className="review-text">{record.review}</p>}
          <button
            type="button"
            className="button button-small"
            onClick={() => setDraft(record.review ?? '')}
          >
            {record.review ? 'Edit review' : 'Write a review'}
          </button>
        </>
      ) : (
        <form className="review-form" onSubmit={saveReview}>
          <div className="field">
            <label htmlFor={`${id}-review`}>Review</label>
            <textarea
              id={`${id}-review`}
              rows={4}
              maxLength={REVIEW_MAX_LENGTH}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
            <span className="hint">
              Shown on your profile if you make it public. Notes stay private.
            </span>
          </div>
          <div className="form-actions">
            <button type="submit" className="button button-primary" disabled={setReview.isPending}>
              {setReview.isPending ? 'Saving…' : 'Save review'}
            </button>
            <button type="button" className="button" onClick={() => setDraft(null)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {setReview.isError && (
        <div className="error-box" role="alert">
          <p>Couldn't save: {describeError(setReview.error)}</p>
        </div>
      )}
    </section>
  );
}
