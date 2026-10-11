// ============================================================================
// Shelf.tsx: SOMEONE'S RECORDS, AS A GRID OF COVERS
//
// Like the collection page, but read-only: record pages are private, so the
// covers aren't links.
// ============================================================================

import type { ShelfRecord } from '@vinyl/shared';
import { formatArtists } from '../collection/format';
import { RecordCover } from '../collection/RecordCover';
import { Stars } from '../ratings/Stars';
import { formatPlays } from '../stats/format';

export function Shelf({ records }: { records: ShelfRecord[] }) {
  return (
    <section className="profile-section" aria-label="Shelf">
      <h2>
        Shelf <span className="count">{records.length}</span>
      </h2>
      {records.length === 0 ? (
        <p className="muted">No records on the shelf yet.</p>
      ) : (
        <ul className="record-grid">
          {records.map((record) => (
            <li key={record.id} className="record-card">
              <RecordCover record={record} />
              <span className="record-card-title">{record.title}</span>
              <span className="record-card-artist">{formatArtists(record.artists)}</span>
              <span className="record-card-meta">
                {[
                  record.year,
                  record.spinCount > 0 ? formatPlays(record.spinCount) : 'Not played yet',
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
              {record.rating !== null && <Stars rating={record.rating} />}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
