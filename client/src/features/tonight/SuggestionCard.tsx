// ============================================================================
// SuggestionCard.tsx: ONE SUGGESTED RECORD
//
// The cover, what to put on ("Side A" or the whole record), why it was picked,
// and a button that logs the play as starting now, in one click.
// ============================================================================

import { Link } from 'react-router';
import type { Suggestion } from '@vinyl/shared';
import { describeError } from '../../api/client';
import { useLogSpin } from '../../api/spins';
import { formatArtists } from '../collection/format';
import { RecordCover } from '../collection/RecordCover';
import { Stars } from '../ratings/Stars';
import { formatSides } from '../spins/sides';
import { reasonsFor } from './reasons';

type Props = { suggestion: Suggestion; minutes: number | null };

export function SuggestionCard({ suggestion, minutes }: Props) {
  // Each card has its own "log a play" state, so one card's button doesn't affect the others.
  const logSpin = useLogSpin();
  const { record, sides, durationSeconds } = suggestion;
  // "Side A" -> "side A": only the first letter goes lowercase, not the side's own letter.
  const what = sides === null ? 'the whole record' : formatSides(sides).replace('S', 's');

  return (
    <li className="suggestion">
      <Link to={`/records/${record.id}`} className="suggestion-cover" tabIndex={-1}>
        <RecordCover record={record} />
      </Link>
      <div className="suggestion-body">
        <h2>
          <Link to={`/records/${record.id}`}>{record.title}</Link>
        </h2>
        <p className="muted">
          {[formatArtists(record.artists), suggestion.year].filter(Boolean).join(' · ')}
        </p>
        {suggestion.rating !== null && <Stars rating={suggestion.rating} />}
        <p className="suggestion-what">Put on {what}</p>
        <ul className="suggestion-reasons">
          {reasonsFor(suggestion, minutes).map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>

        {logSpin.isSuccess ? (
          // role="status": screen readers announce it when it appears.
          <p className="suggestion-logged" role="status">
            ✓ Logged. Enjoy!
          </p>
        ) : durationSeconds === null ? (
          // Without a known length, the play is logged on the record's page instead.
          <Link to={`/records/${record.id}`} className="button">
            Open record
          </Link>
        ) : (
          <button
            type="button"
            className="button button-primary"
            disabled={logSpin.isPending}
            // No start time is sent, so the server uses "now": the play is starting.
            onClick={() => logSpin.mutate({ recordId: record.id, sides, durationSeconds })}
          >
            {logSpin.isPending ? 'Logging…' : '▶ Play this now'}
          </button>
        )}
        {logSpin.isError && (
          <p className="field-error" role="alert">
            Couldn't log it: {describeError(logSpin.error)}
          </p>
        )}
      </div>
    </li>
  );
}
