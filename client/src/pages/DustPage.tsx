// ============================================================================
// DustPage.tsx: THE DUST REPORT (/dust)
//
// Records you own but aren't playing, to help you rediscover your shelf:
//   "6 of 14 records haven't been played in [90 days ▾]"   [Pick one for me]
//   Gathering dust: played before, but not recently (longest-forgotten first)
//   Never played: no plays logged yet (longest-owned first)
//
// The number of days is a saved setting. "Pick one for me" opens a random
// record from either list.
// ============================================================================

import { Link, useNavigate } from 'react-router';
import { describeError } from '../api/client';
import { useDustReport, useUpdateSettings } from '../api/dust';
import { DustGrid } from '../features/dust/DustGrid';

const THRESHOLD_OPTIONS = [30, 60, 90, 180, 365];

function thresholdLabel(days: number): string {
  if (days === 365) return '1 year';
  return `${days} days`;
}

export function DustPage() {
  const report = useDustReport();
  const updateSettings = useUpdateSettings();
  const navigate = useNavigate();

  if (report.isPending) return <p className="muted">Checking your shelf…</p>;
  if (report.isError) {
    return (
      <div className="error-box" role="alert">
        <p>Couldn't load the dust report: {describeError(report.error)}</p>
      </div>
    );
  }

  const { thresholdDays, collectionCount, dusty, neverPlayed } = report.data;
  const forgotten = [...dusty, ...neverPlayed];
  // Keep a saved value that isn't one of the usual choices (e.g. 45 days) selectable.
  const options = THRESHOLD_OPTIONS.includes(thresholdDays)
    ? THRESHOLD_OPTIONS
    : [...THRESHOLD_OPTIONS, thresholdDays].sort((a, b) => a - b);

  function pickOne() {
    const pick = forgotten[Math.floor(Math.random() * forgotten.length)];
    if (pick) navigate(`/records/${pick.record.id}`);
  }

  if (collectionCount === 0) {
    return (
      <section>
        <h1>Dust report</h1>
        <div className="empty-state">
          <h2>No records yet</h2>
          <p>Add some records, and this page will show the ones you haven't played in a while.</p>
          <Link to="/discogs" className="button button-primary">
            + Add from Discogs
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="page-header">
        <h1>Dust report</h1>
        {forgotten.length > 0 && (
          <button type="button" className="button button-primary" onClick={pickOne}>
            🎲 Pick one for me
          </button>
        )}
      </div>

      <p className="dust-summary">
        <strong>
          {forgotten.length} of {collectionCount}
        </strong>{' '}
        {collectionCount === 1 ? 'record hasn’t' : 'records haven’t'} been played in{' '}
        <label>
          <span className="visually-hidden">Days without a play</span>
          <select
            value={thresholdDays}
            disabled={updateSettings.isPending}
            onChange={(event) =>
              updateSettings.mutate({ dustThresholdDays: Number(event.target.value) })
            }
          >
            {options.map((days) => (
              <option key={days} value={days}>
                {thresholdLabel(days)}
              </option>
            ))}
          </select>
        </label>
        .
      </p>
      {updateSettings.isError && (
        <p className="field-error" role="alert">
          Couldn't save that: {describeError(updateSettings.error)}
        </p>
      )}

      {forgotten.length === 0 && (
        <div className="empty-state">
          <h2>Nothing gathering dust</h2>
          <p>Every record has been played in the last {thresholdLabel(thresholdDays)}. Nice.</p>
        </div>
      )}

      {dusty.length > 0 && (
        <section className="dust-section" aria-labelledby="dusty-heading">
          <h2 id="dusty-heading">
            Gathering dust <span className="count">{dusty.length}</span>
          </h2>
          <DustGrid items={dusty} />
        </section>
      )}

      {neverPlayed.length > 0 && (
        <section className="dust-section" aria-labelledby="never-heading">
          <h2 id="never-heading">
            Never played <span className="count">{neverPlayed.length}</span>
          </h2>
          <DustGrid items={neverPlayed} />
        </section>
      )}
    </section>
  );
}
