// ============================================================================
// ProfilePage.tsx: A PUBLIC PROFILE (/u/username)
//
// Anyone can open it once its owner has made it public, without logging in:
// totals, links to each "year in records", most-played records and artists,
// recent plays, highest-rated records, reviews, and the whole shelf. The owner also sees it while it's private,
// with the switch to make it public.
// ============================================================================

import { Link, useParams } from 'react-router';
import type { Profile } from '@vinyl/shared';
import { ApiRequestError, describeError } from '../api/client';
import { useProfile } from '../api/profiles';
import { formatArtists } from '../features/collection/format';
import { RecordCover } from '../features/collection/RecordCover';
import { ProfileHeader } from '../features/profiles/ProfileHeader';
import { RecentPlays } from '../features/profiles/RecentPlays';
import { HighestRated, Reviews } from '../features/profiles/Reviews';
import { Shelf } from '../features/profiles/Shelf';
import { formatHours } from '../features/stats/format';
import { RankedBars } from '../features/stats/RankedBars';

export function ProfilePage() {
  const { username = '' } = useParams();
  const profile = useProfile(username);

  if (profile.isPending) return <p className="muted">Loading the profile…</p>;
  if (profile.isError) return <ProfileError error={profile.error} />;
  return <ProfileBody profile={profile.data} />;
}

/** "Not found" for both private and missing profiles (the server can't tell them apart either). */
export function ProfileError({ error }: { error: Error }) {
  if (error instanceof ApiRequestError && error.code === 'PROFILE_NOT_FOUND') {
    return (
      <div className="empty-state">
        <h1>No profile here</h1>
        <p>This profile doesn't exist, or its owner hasn't made it public.</p>
        <Link to="/" className="button button-primary">
          Go to Vinyl Tracker
        </Link>
      </div>
    );
  }
  return (
    <div className="error-box" role="alert">
      <p>Couldn't load this profile: {describeError(error)}</p>
    </div>
  );
}

function ProfileBody({ profile }: { profile: Profile }) {
  const { username } = profile.user;
  const tiles = [
    { label: 'Records', value: profile.totals.recordCount.toLocaleString() },
    { label: 'Plays', value: profile.totals.spinCount.toLocaleString() },
    { label: 'Listening time', value: formatHours(profile.totals.listeningSeconds) },
  ];

  return (
    <section className="profile">
      <ProfileHeader profile={profile} />

      <dl className="stat-tiles">
        {tiles.map((tile) => (
          <div key={tile.label} className="stat-tile">
            <dt>{tile.label}</dt>
            <dd>{tile.value}</dd>
          </div>
        ))}
      </dl>

      {profile.years.length > 0 && (
        <nav className="year-links" aria-label="Year in records">
          <span className="muted">Year in records:</span>
          {profile.years.map((year) => (
            <Link key={year} to={`/u/${username}/year/${year}`} className="button button-small">
              {year}
            </Link>
          ))}
        </nav>
      )}

      {profile.totals.spinCount > 0 ? (
        <>
          <div className="stats-columns">
            <RankedBars
              title="Most-played records"
              items={profile.topRecords.map(({ record, listeningSeconds, spinCount }) => ({
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
              title="Most-played artists"
              items={profile.topArtists.map((artist) => ({
                key: artist.id,
                label: artist.name,
                listeningSeconds: artist.listeningSeconds,
                spinCount: artist.spinCount,
              }))}
            />
          </div>
          <RecentPlays plays={profile.recentPlays} />
        </>
      ) : (
        <p className="muted">No plays logged yet.</p>
      )}

      <HighestRated records={profile.highestRated} />
      <Reviews reviews={profile.reviews} />
      <Shelf records={profile.shelf} />
    </section>
  );
}
