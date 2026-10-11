// ============================================================================
// YearInRecordsPage.tsx: ONE YEAR'S RECAP (/u/username/year/2026)
//
// Like a year-end "wrapped", but for records: totals, the record of the year,
// the busiest month, listening by month, and the top records, artists and
// genres. Public on the same terms as the profile it belongs to.
// ============================================================================

import { Link, useParams } from 'react-router';
import type { YearInRecords } from '@vinyl/shared';
import { useYearInRecords } from '../api/profiles';
import { formatArtists } from '../features/collection/format';
import { RecordCover } from '../features/collection/RecordCover';
import { MonthChart } from '../features/profiles/MonthChart';
import { busiestMonth } from '../features/profiles/year';
import { Stars } from '../features/ratings/Stars';
import { formatListening, formatMonth, formatPlays } from '../features/stats/format';
import { RankedBars } from '../features/stats/RankedBars';
import { StatTiles } from '../features/stats/StatTiles';
import { ProfileError } from './ProfilePage';

export function YearInRecordsPage() {
  const { username = '', year: yearParam = '' } = useParams();
  const year = Number(yearParam);
  const recap = useYearInRecords(username, year);

  if (recap.isPending) return <p className="muted">Adding up the year…</p>;
  if (recap.isError) return <ProfileError error={recap.error} />;
  return <YearBody recap={recap.data} />;
}

function YearBody({ recap }: { recap: YearInRecords }) {
  const { user, year, totals } = recap;
  const recordOfTheYear = recap.topRecords[0];
  const busiest = busiestMonth(recap.months);

  return (
    <section className="year-in-records">
      <Link to={`/u/${user.username}`} className="back-link">
        ← {user.displayName}
      </Link>
      <div className="page-header">
        <h1>{year} in records</h1>
      </div>

      {totals.spinCount === 0 ? (
        <div className="empty-state">
          <h2>No plays logged in {year}</h2>
        </div>
      ) : (
        <div className="stats-body">
          <StatTiles totals={totals} />

          <div className="year-highlights">
            {recordOfTheYear && (
              <div className="record-of-the-year">
                <span className="year-cover">
                  <RecordCover record={recordOfTheYear.record} />
                </span>
                <div>
                  <p className="eyebrow">Record of the year</p>
                  <h2>{recordOfTheYear.record.title}</h2>
                  <p className="muted">{formatArtists(recordOfTheYear.record.artists)}</p>
                  <p>
                    {formatListening(recordOfTheYear.listeningSeconds)} ·{' '}
                    {formatPlays(recordOfTheYear.spinCount)}
                  </p>
                </div>
              </div>
            )}
            <dl className="year-facts">
              {busiest && (
                <div>
                  <dt>Busiest month</dt>
                  <dd>
                    {formatMonth(busiest.month, true)}{' '}
                    <span className="muted">({formatListening(busiest.listeningSeconds)})</span>
                  </dd>
                </div>
              )}
              {recap.topArtists[0] && (
                <div>
                  <dt>Artist of the year</dt>
                  <dd>{recap.topArtists[0].name}</dd>
                </div>
              )}
              {recap.highestRated && (
                <div>
                  <dt>Highest rated</dt>
                  <dd>
                    {recap.highestRated.record.title} <Stars rating={recap.highestRated.rating} />
                  </dd>
                </div>
              )}
              <div>
                <dt>New on the shelf</dt>
                <dd>
                  {recap.addedCount} {recap.addedCount === 1 ? 'record' : 'records'}
                </dd>
              </div>
            </dl>
          </div>

          <MonthChart months={recap.months} />

          <div className="stats-columns">
            <RankedBars
              title="Top records"
              items={recap.topRecords.map(({ record, listeningSeconds, spinCount }) => ({
                key: record.id,
                label: record.title,
                sublabel: formatArtists(record.artists),
                leading: (
                  <span className="ranked-cover">
                    <RecordCover record={record} />
                  </span>
                ),
                listeningSeconds,
                spinCount,
              }))}
            />
            <RankedBars
              title="Top artists"
              items={recap.topArtists.map((artist) => ({
                key: artist.id,
                label: artist.name,
                listeningSeconds: artist.listeningSeconds,
                spinCount: artist.spinCount,
              }))}
            />
          </div>

          <RankedBars
            title="Top genres"
            items={recap.topGenres.map((genre) => ({
              key: genre.name,
              label: genre.name,
              listeningSeconds: genre.listeningSeconds,
            }))}
          />
        </div>
      )}
    </section>
  );
}
