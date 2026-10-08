// ============================================================================
// Tracklist.tsx: A RECORD'S SONGS, GROUPED BY SIDE
//
//   Side A                    23:55
//     A1  So What              8:56
//     A2  Freddie Freeloader   9:32
// ============================================================================

import type { Track } from '@vinyl/shared';
import { formatDuration } from '../collection/format';
import { groupBySide } from './sides';

export function Tracklist({ tracks }: { tracks: Track[] }) {
  return (
    <div className="tracklist">
      {groupBySide(tracks).map((group) => (
        <section
          key={group.side ?? 'tracks'}
          aria-label={group.side ? `Side ${group.side}` : 'Tracks'}
        >
          <h3 className="side-heading">
            <span>{group.side ? `Side ${group.side}` : 'Tracks'}</span>
            {group.durationSeconds !== null && (
              <span className="muted">{formatDuration(group.durationSeconds)}</span>
            )}
          </h3>
          <ol className="tracks">
            {group.tracks.map((track) => (
              <li key={track.id}>
                <span className="track-position">{track.position}</span>
                <span className="track-title">{track.title}</span>
                <span className="muted">
                  {track.durationSeconds === null ? '' : formatDuration(track.durationSeconds)}
                </span>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
