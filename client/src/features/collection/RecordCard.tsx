// ============================================================================
// RecordCard.tsx: ONE RECORD IN THE COLLECTION GRID
//
// The cover, title, artists, year and format. Clicking it opens the record's page.
// ============================================================================

import { Link } from 'react-router';
import type { VinylRecord } from '@vinyl/shared';
import { formatArtists } from './format';
import { RecordCover } from './RecordCover';

export function RecordCard({ record }: { record: VinylRecord }) {
  const details = [record.year, record.format].filter(Boolean).join(' · ');

  return (
    <Link to={`/records/${record.id}`} className="record-card">
      <RecordCover record={record} />
      <span className="record-card-title">{record.title}</span>
      <span className="record-card-artist">{formatArtists(record.artists)}</span>
      {details && <span className="record-card-meta">{details}</span>}
    </Link>
  );
}
