// ============================================================================
// DustGrid.tsx: A GRID OF FORGOTTEN RECORDS
//
// Like the collection grid, but each card says how long it's been:
//   "Last played 4 months ago · 3 plays"   or   "Added 2 years ago"
// ============================================================================

import { Link } from 'react-router';
import type { DustRecord } from '@vinyl/shared';
import { formatArtists } from '../collection/format';
import { RecordCover } from '../collection/RecordCover';
import { formatDaysAgo } from './time-ago';

export function DustGrid({ items }: { items: DustRecord[] }) {
  return (
    <ul className="record-grid">
      {items.map((item) => (
        <li key={item.record.id}>
          <Link to={`/records/${item.record.id}`} className="record-card dust-card">
            <RecordCover record={item.record} />
            <span className="record-card-title">{item.record.title}</span>
            <span className="record-card-artist">{formatArtists(item.record.artists)}</span>
            <span className="record-card-meta">
              {item.lastPlayedAt === null
                ? `Added ${formatDaysAgo(item.days)}`
                : `Last played ${formatDaysAgo(item.days)} · ${item.spinCount} ${
                    item.spinCount === 1 ? 'play' : 'plays'
                  }`}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
