// ============================================================================
// RecordCover.tsx: A RECORD'S COVER PICTURE
//
// Shows the cover image if the record has one. If not (or it fails to load),
// draws a vinyl disc instead, with a center label colored from the title so
// every record looks a little different.
// ============================================================================

import { useState, type CSSProperties } from 'react';
import type { VinylRecord } from '@vinyl/shared';

type Props = { record: Pick<VinylRecord, 'title' | 'coverImageUrl'> };

export function RecordCover({ record }: Props) {
  // useState gives a component its own memory. Here: "did the image fail to load?"
  // Calling setFailed(true) makes React redraw with the placeholder.
  const [failed, setFailed] = useState(false);

  if (record.coverImageUrl && !failed) {
    return (
      <img
        className="cover"
        src={record.coverImageUrl}
        alt={`Cover of ${record.title}`}
        loading="lazy"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div
      className="cover cover-placeholder"
      role="img"
      aria-label={`No cover image for ${record.title}`}
      style={{ '--label-hue': hueFor(record.title) } as CSSProperties}
    >
      <span className="vinyl" />
    </div>
  );
}

/** Turns text into a color angle (0-359), always the same for the same text. */
function hueFor(text: string): number {
  let hash = 0;
  for (const char of text) hash = (hash * 31 + char.charCodeAt(0)) % 360;
  return hash;
}
