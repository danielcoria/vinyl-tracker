// ============================================================================
// StatsPage.tsx: YOUR LISTENING STATS (/stats)
//
//   [Last 30 days] [This year] [All time]      <- the period, chosen once for
//                                                 everything below
//   [plays] [hours] [records] [artists]
//   Most-listened artists   |  Most-listened records
//   Genres by month (chart)
//
// The chosen period lives in the address (/stats?period=year) so it's kept
// when you come back or share the link.
// ============================================================================

import { Link, useSearchParams } from 'react-router';
import { describeError } from '../api/client';
import { PERIOD_LABELS, PERIODS, useStats, type Period } from '../api/stats';
import { formatArtists } from '../features/collection/format';
import { RecordCover } from '../features/collection/RecordCover';
import { GenresByMonth } from '../features/stats/GenresByMonth';
import { RankedBars } from '../features/stats/RankedBars';
import { StatTiles } from '../features/stats/StatTiles';

function isPeriod(value: string | null): value is Period {
  return PERIODS.some((p) => p === value);
}

export function StatsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const param = searchParams.get('period');
  const period: Period = isPeriod(param) ? param : 'year';
  const stats = useStats(period);

  return (
    <section>
      <div className="page-header">
        <h1>Stats</h1>
      </div>

      <div className="segmented" role="group" aria-label="Period">
        {PERIODS.map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={p === period}
            onClick={() => setSearchParams(p === 'year' ? {} : { period: p }, { replace: true })}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {stats.isPending ? (
        <p className="muted">Adding up your plays…</p>
      ) : stats.isError ? (
        <div className="error-box" role="alert">
          <p>Couldn't load your stats: {describeError(stats.error)}</p>
        </div>
      ) : stats.data.totals.spinCount === 0 ? (
        <div className="empty-state">
          <h2>No plays {period === 'all' ? 'yet' : 'in this period'}</h2>
          <p>Stats come from your listening diary. Log a play on any record to get started.</p>
          <Link to="/" className="button button-primary">
            Go to your collection
          </Link>
        </div>
      ) : (
        // While another period loads, the old numbers stay, slightly faded.
        <div className={stats.isPlaceholderData ? 'stats-body is-refreshing' : 'stats-body'}>
          <StatTiles totals={stats.data.totals} />

          <div className="stats-columns">
            <RankedBars
              title="Most-listened artists"
              items={stats.data.topArtists.map((artist) => ({
                key: artist.id,
                label: artist.name,
                listeningSeconds: artist.listeningSeconds,
                spinCount: artist.spinCount,
              }))}
            />
            <RankedBars
              title="Most-listened records"
              items={stats.data.topRecords.map(({ record, listeningSeconds, spinCount }) => ({
                key: record.id,
                label: record.title,
                sublabel: formatArtists(record.artists),
                href: `/records/${record.id}`,
                leading: (
                  <span className="ranked-cover">
                    <RecordCover record={record} />
                  </span>
                ),
                listeningSeconds,
                spinCount,
              }))}
            />
          </div>

          <GenresByMonth data={stats.data.genresByMonth} />
        </div>
      )}
    </section>
  );
}
