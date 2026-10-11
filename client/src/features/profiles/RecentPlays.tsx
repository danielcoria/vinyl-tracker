// ============================================================================
// RecentPlays.tsx: THE LATEST PLAYS ON A PROFILE
//
// A read-only version of the diary list: no notes and no delete buttons, but
// with the stars a listen was given.
// ============================================================================

import type { Profile } from '@vinyl/shared';
import { formatArtists, formatDuration } from '../collection/format';
import { RecordCover } from '../collection/RecordCover';
import { Stars } from '../ratings/Stars';
import { formatShortDate } from '../spins/dates';
import { formatSides } from '../spins/sides';

export function RecentPlays({ plays }: { plays: Profile['recentPlays'] }) {
  return (
    <section className="profile-section" aria-label="Recent plays">
      <h2>Recent plays</h2>
      <ul className="spin-list">
        {plays.map((play) => (
          <li key={`${play.playedAt}-${play.record.id}`} className="spin spin-with-record">
            <span className="spin-cover">
              <RecordCover record={play.record} />
            </span>
            <div className="spin-info">
              <span className="spin-title">{play.record.title}</span>
              <span className="muted">{formatArtists(play.record.artists)}</span>
              <span className="spin-meta">
                {formatShortDate(play.playedAt)} · {formatSides(play.sides)} ·{' '}
                {formatDuration(play.durationSeconds)}
                {play.rating !== null && (
                  <>
                    {' · '}
                    <Stars rating={play.rating} />
                  </>
                )}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
