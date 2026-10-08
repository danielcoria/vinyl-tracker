// ============================================================================
// DiaryPage.tsx: THE LISTENING DIARY (/diary)
//
// Every logged play, newest first, grouped by day:
//
//   Monday, October 6
//     [cover] Kind of Blue · Miles Davis · 9:15 PM · Side A · 23:55
//     [cover] Blue · Joni Mitchell · 7:02 PM · Whole record · 36:15
// ============================================================================

import { Link } from 'react-router';
import type { Spin } from '@vinyl/shared';
import { describeError } from '../api/client';
import { useSpins } from '../api/spins';
import { formatDay, localDayKey } from '../features/spins/dates';
import { SpinList } from '../features/spins/SpinList';

export function DiaryPage() {
  const spins = useSpins({ limit: 200 });

  return (
    <section>
      <div className="page-header">
        <h1>Listening diary</h1>
      </div>

      {spins.isPending ? (
        <p className="muted">Loading your plays…</p>
      ) : spins.isError ? (
        <div className="error-box" role="alert">
          <p>Couldn't load your plays: {describeError(spins.error)}</p>
        </div>
      ) : spins.data.length === 0 ? (
        <div className="empty-state">
          <h2>No plays yet</h2>
          <p>Open a record and press “Log a play” after you listen to it.</p>
          <Link to="/" className="button button-primary">
            Go to your collection
          </Link>
        </div>
      ) : (
        groupByDay(spins.data).map(({ key, label, spins: daySpins }) => (
          <section key={key} className="diary-day" aria-label={label}>
            <h2 className="diary-day-heading">{label}</h2>
            <SpinList spins={daySpins} showRecord />
          </section>
        ))
      )}
    </section>
  );
}

/** Splits plays (already newest first) into one group per local day. */
function groupByDay(spins: Spin[]) {
  const days: { key: string; label: string; spins: Spin[] }[] = [];
  for (const spin of spins) {
    const key = localDayKey(spin.playedAt);
    let day = days.at(-1);
    if (!day || day.key !== key) {
      day = { key, label: formatDay(spin.playedAt), spins: [] };
      days.push(day);
    }
    day.spins.push(spin);
  }
  return days;
}
