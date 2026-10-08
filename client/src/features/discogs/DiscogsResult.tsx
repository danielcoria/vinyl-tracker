// ============================================================================
// DiscogsResult.tsx: ONE RELEASE IN THE DISCOGS SEARCH RESULTS
//
// Shows the thumbnail, artist, title and details (year, format, label,
// catalog number, country) so you can tell different pressings apart.
// The button on the right is passed in by the page ("Add to collection" or
// "Use this release"), so the same row works for both jobs.
// ============================================================================

import type { ReactNode } from 'react';
import type { DiscogsSearchResult } from '@vinyl/shared';
import { RecordCover } from '../collection/RecordCover';

type Props = { result: DiscogsSearchResult; action: ReactNode };

export function DiscogsResult({ result, action }: Props) {
  const label = [result.label, result.catalogNumber].filter(Boolean).join(' · ');
  const details = [result.year, result.format, result.country].filter(Boolean).join(' · ');

  return (
    <li className="discogs-result">
      <div className="discogs-thumb">
        <RecordCover record={{ title: result.title, coverImageUrl: result.thumbUrl }} />
      </div>
      <div className="discogs-info">
        <span className="discogs-title">{result.title}</span>
        <span className="discogs-artist">{result.artist || 'Unknown artist'}</span>
        {details && <span className="discogs-meta">{details}</span>}
        {label && <span className="discogs-meta">{label}</span>}
      </div>
      <div className="discogs-action">{action}</div>
    </li>
  );
}
