// ============================================================================
// RecordPlays.tsx: THE LISTENING PART OF A RECORD'S PAGE
//
//   Played 3 times · last on Oct 5, 2026        [Log a play]
//   (the Log a play panel opens here)
//   Your plays: Oct 5 · Side A · 23:55 ...
//   Tracklist: Side A ... Side B ...
//
// If the record is linked to Discogs but has no tracklist yet (it was linked
// before tracklists were saved), it offers to fetch it.
// ============================================================================

import { useState } from 'react';
import type { VinylRecord } from '@vinyl/shared';
import { describeError } from '../../api/client';
import { useLinkRecord } from '../../api/discogs';
import { useSpins, useTracks } from '../../api/spins';
import { formatShortDate } from './dates';
import { LogSpinPanel } from './LogSpinPanel';
import { SpinList } from './SpinList';
import { Tracklist } from './Tracklist';

export function RecordPlays({ record }: { record: VinylRecord }) {
  const tracks = useTracks(record.id);
  const spins = useSpins({ recordId: record.id, limit: 20 });
  const linkRecord = useLinkRecord();
  const [panelOpen, setPanelOpen] = useState(false);
  const [lastLogged, setLastLogged] = useState<string | null>(null);

  const trackList = tracks.data ?? [];
  const needsTracklist =
    record.discogsReleaseId !== null && tracks.isSuccess && tracks.data.length === 0;

  return (
    <section className="record-plays" aria-labelledby="plays-heading">
      <div className="plays-header">
        <div>
          <h2 id="plays-heading">Plays</h2>
          <p className="muted">
            {record.spinCount === 0
              ? 'Not played yet.'
              : `Played ${record.spinCount} ${record.spinCount === 1 ? 'time' : 'times'}` +
                (record.lastPlayedAt ? ` · last on ${formatShortDate(record.lastPlayedAt)}` : '')}
          </p>
        </div>
        {!panelOpen && (
          <button
            type="button"
            className="button button-primary"
            // Wait for the tracklist so the sides can be shown.
            disabled={tracks.isPending}
            onClick={() => {
              setLastLogged(null);
              setPanelOpen(true);
            }}
          >
            ▶ Log a play
          </button>
        )}
      </div>

      {lastLogged && (
        <p className="success-box" role="status">
          Logged: {lastLogged}.
        </p>
      )}

      {panelOpen && (
        <LogSpinPanel
          record={record}
          tracks={trackList}
          onClose={(logged) => {
            setPanelOpen(false);
            setLastLogged(logged);
          }}
        />
      )}

      {spins.data && spins.data.length > 0 && <SpinList spins={spins.data} />}

      <h2>Tracklist</h2>
      {tracks.isPending ? (
        <p className="muted">Loading…</p>
      ) : trackList.length > 0 ? (
        <Tracklist tracks={trackList} />
      ) : needsTracklist ? (
        <div>
          <p className="muted">No tracklist saved yet. Discogs has one for this release.</p>
          <button
            type="button"
            className="button"
            disabled={linkRecord.isPending}
            onClick={() =>
              record.discogsReleaseId &&
              linkRecord.mutate({ recordId: record.id, releaseId: record.discogsReleaseId })
            }
          >
            {linkRecord.isPending ? 'Getting tracklist…' : 'Get tracklist from Discogs'}
          </button>
          {linkRecord.isError && (
            <p className="field-error" role="alert">
              {describeError(linkRecord.error)}
            </p>
          )}
        </div>
      ) : (
        <p className="muted">
          No tracklist. Use “Find on Discogs” to add one, so you can log plays by side.
        </p>
      )}
    </section>
  );
}
