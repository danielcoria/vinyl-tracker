// ============================================================================
// SpinList.tsx: A LIST OF LOGGED PLAYS
//
// Used in two places:
//   - the Diary page (showRecord): every play, with the record's cover and name
//   - a record's page: just that record's plays
// Each play shows when, which sides, how long, any notes, and a delete button.
// ============================================================================

import { Link } from 'react-router';
import type { Spin } from '@vinyl/shared';
import { describeError } from '../../api/client';
import { useDeleteSpin } from '../../api/spins';
import { formatArtists, formatDuration } from '../collection/format';
import { RecordCover } from '../collection/RecordCover';
import { formatShortDate, formatTime } from './dates';
import { formatSides } from './sides';

type Props = {
  spins: Spin[];
  /** Show the record's cover and name (for the diary, where plays are of many records). */
  showRecord?: boolean;
};

export function SpinList({ spins, showRecord = false }: Props) {
  const deleteSpin = useDeleteSpin();

  function handleDelete(spin: Spin) {
    if (!window.confirm(`Delete this play of “${spin.record.title}”?`)) return;
    deleteSpin.mutate(spin.id);
  }

  return (
    <>
      {deleteSpin.isError && (
        <div className="error-box" role="alert">
          <p>Couldn't delete that play: {describeError(deleteSpin.error)}</p>
        </div>
      )}
      <ul className="spin-list">
        {spins.map((spin) => (
          <li key={spin.id} className={showRecord ? 'spin spin-with-record' : 'spin'}>
            {showRecord && (
              <Link to={`/records/${spin.record.id}`} className="spin-cover" tabIndex={-1}>
                <RecordCover record={spin.record} />
              </Link>
            )}
            <div className="spin-info">
              {showRecord && (
                <>
                  <Link to={`/records/${spin.record.id}`} className="spin-title">
                    {spin.record.title}
                  </Link>
                  <span className="muted">{formatArtists(spin.record.artists)}</span>
                </>
              )}
              <span className="spin-meta">
                {showRecord ? formatTime(spin.playedAt) : formatShortDate(spin.playedAt)}
                {' · '}
                {formatSides(spin.sides)} · {formatDuration(spin.durationSeconds)}
              </span>
              {spin.notes && <span className="spin-notes">{spin.notes}</span>}
            </div>
            <button
              type="button"
              className="button button-icon"
              aria-label={`Delete play from ${formatShortDate(spin.playedAt)}`}
              onClick={() => handleDelete(spin)}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
