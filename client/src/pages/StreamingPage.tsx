// ============================================================================
// StreamingPage.tsx: STREAMING VS. SHELF (/streaming)
//
// Compares the albums someone streams most (from Last.fm) with the records on
// their shelf: "streamed 412 times, not on your shelf, from $28 on vinyl".
// Albums can be added to the wishlist from here.
//
// First visit: asks for a Last.fm username. After that, three groups: streamed
// albums that aren't on the shelf, ones owned in a different edition (a
// collector may want both, so they keep their price and wishlist button), and
// ones that are on the shelf.
// ============================================================================

import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { STREAMING_PERIODS, type StreamedAlbum, type StreamingPeriod } from '@vinyl/shared';
import { ApiRequestError, describeError } from '../api/client';
import { useSettings } from '../api/dust';
import { useAddToWishlist, useStreaming } from '../api/streaming';
import { RecordCover } from '../features/collection/RecordCover';
import { findOnDiscogsUrl, formatStreams } from '../features/streaming/format';
import { LastfmConnect } from '../features/streaming/LastfmConnect';
import { PriceTag } from '../features/streaming/PriceTag';

const PERIOD_LABELS: Record<StreamingPeriod, string> = {
  overall: 'All time',
  '12month': 'Last 12 months',
  '6month': 'Last 6 months',
  '3month': 'Last 3 months',
  '1month': 'Last month',
};

/** How many albums look their price up by themselves (the rest have a button). */
const AUTO_PRICES = 5;

function isPeriod(value: string | null): value is StreamingPeriod {
  return STREAMING_PERIODS.some((p) => p === value);
}

export function StreamingPage() {
  const settings = useSettings();
  const [searchParams, setSearchParams] = useSearchParams();
  const param = searchParams.get('period');
  const period: StreamingPeriod = isPeriod(param) ? param : '12month';
  const [changing, setChanging] = useState(false);

  const username = settings.data?.lastfmUsername ?? null;
  const streaming = useStreaming(period, username !== null);

  if (settings.isPending) return <p className="muted">Loading…</p>;
  if (settings.isError) {
    return (
      <div className="error-box" role="alert">
        <p>Couldn't load your settings: {describeError(settings.error)}</p>
      </div>
    );
  }

  return (
    <section className="streaming">
      <div className="page-header">
        <h1>Streaming vs. shelf</h1>
        <Link to="/wishlist" className="button">
          Wishlist
        </Link>
      </div>

      {username === null ? (
        <div className="streaming-intro">
          <p>
            See which albums you stream the most but don't own on vinyl, and what they cost right
            now. It reads your public listening history from Last.fm.
          </p>
          <LastfmConnect current={null} />
          {/* <details> is a built-in "click to open" box: no code needed to show or hide it. */}
          <details className="help-box">
            <summary>Don't have a Last.fm username?</summary>
            <ol>
              <li>
                Create a free account at{' '}
                <a href="https://www.last.fm/join" target="_blank" rel="noreferrer">
                  last.fm/join
                </a>
                .
              </li>
              <li>
                Connect your streaming service (for example Spotify) in{' '}
                <a
                  href="https://www.last.fm/settings/applications"
                  target="_blank"
                  rel="noreferrer"
                >
                  Last.fm's settings
                </a>
                , so it starts keeping a history of what you play.
              </li>
              <li>
                Listen for a few days, then come back and enter the username from your profile's
                address.
              </li>
            </ol>
          </details>
        </div>
      ) : (
        <>
          <div className="toolbar">
            <span>
              Last.fm: <strong>{username}</strong>
            </span>
            <button
              type="button"
              className="button button-small"
              onClick={() => setChanging((v) => !v)}
            >
              {changing ? 'Cancel' : 'Change'}
            </button>
            <label className="sort">
              Period
              <select
                value={period}
                onChange={(event) =>
                  setSearchParams(
                    event.target.value === '12month' ? {} : { period: event.target.value },
                    { replace: true },
                  )
                }
              >
                {STREAMING_PERIODS.map((p) => (
                  <option key={p} value={p}>
                    {PERIOD_LABELS[p]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {changing && <LastfmConnect current={username} onDone={() => setChanging(false)} />}

          {streaming.isPending ? (
            <p className="muted">Asking Last.fm what you've been streaming…</p>
          ) : streaming.isError ? (
            <StreamingError error={streaming.error} />
          ) : (
            <Comparison
              albums={streaming.data.albums}
              sample={streaming.data.sample}
              refreshing={streaming.isPlaceholderData}
            />
          )}
        </>
      )}
    </section>
  );
}

function StreamingError({ error }: { error: Error }) {
  if (error instanceof ApiRequestError && error.code === 'LASTFM_NOT_CONFIGURED') {
    return (
      <div className="empty-state">
        <h2>Last.fm isn't set up on this server</h2>
        <p>
          It needs a free Last.fm API key in the server's <code>.env</code> file (
          <code>LASTFM_API_KEY</code>). The README explains how to get one.
        </p>
      </div>
    );
  }
  return (
    <div className="error-box" role="alert">
      <p>Couldn't compare with Last.fm: {describeError(error)}</p>
    </div>
  );
}

type ComparisonProps = { albums: StreamedAlbum[]; sample: boolean; refreshing: boolean };

function Comparison({ albums, sample, refreshing }: ComparisonProps) {
  const owned = albums.filter((album) => album.ownedRecordId !== null);
  // The same album, but the shelf has another edition of it (regular vs. deluxe...).
  const otherEditions = albums.filter((album) => album.otherEdition !== null);
  const missing = albums.filter(
    (album) => album.ownedRecordId === null && album.otherEdition === null,
  );

  if (albums.length === 0) {
    return (
      <div className="empty-state">
        <h2>Nothing streamed in this period</h2>
        <p>Last.fm has no albums for this account and period. Try a longer one.</p>
      </div>
    );
  }

  return (
    <div className={refreshing ? 'stats-body is-refreshing' : 'stats-body'}>
      {sample && (
        <p className="demo-inline" role="note">
          <strong>Sample data:</strong> the demo isn't connected to a real Last.fm account, so this
          is a made-up listener. Prices are real, from Discogs.
        </p>
      )}
      <p className="streaming-summary">
        You own <strong>{owned.length}</strong> of your <strong>{albums.length}</strong>{' '}
        most-streamed albums on vinyl
        {otherEditions.length > 0 && (
          <>
            , and a different edition of <strong>{otherEditions.length}</strong> more
          </>
        )}
        .
      </p>

      <section aria-label="Not on your shelf">
        <h2>
          Not on your shelf <span className="count">{missing.length}</span>
        </h2>
        {missing.length === 0 ? (
          <p className="muted">You own everything you stream. Impressive.</p>
        ) : (
          <ul className="album-list">
            {missing.map((album, index) => (
              <MissingAlbum key={album.rank} album={album} autoPrice={index < AUTO_PRICES} />
            ))}
          </ul>
        )}
      </section>

      {otherEditions.length > 0 && (
        <section aria-label="You own a different edition">
          <h2>
            You own a different edition <span className="count">{otherEditions.length}</span>
          </h2>
          <p className="muted">
            The album is on your shelf, but not this version of it. Still want this one?
          </p>
          <ul className="album-list">
            {otherEditions.map((album) => (
              <MissingAlbum key={album.rank} album={album} autoPrice={false} />
            ))}
          </ul>
        </section>
      )}

      {owned.length > 0 && (
        <section aria-label="Already on your shelf">
          <h2>
            Already on your shelf <span className="count">{owned.length}</span>
          </h2>
          <ul className="owned-list">
            {owned.map((album) => (
              <li key={album.rank}>
                <Link to={`/records/${album.ownedRecordId}`}>{album.title}</Link>
                <span className="muted">
                  {' '}
                  · {album.artist} · {formatStreams(album.playCount)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function MissingAlbum({ album, autoPrice }: { album: StreamedAlbum; autoPrice: boolean }) {
  // Each album has its own "add" state, so one button doesn't affect the others.
  const addToWishlist = useAddToWishlist();
  const onWishlist = album.wishlistItemId !== null || addToWishlist.isSuccess;

  return (
    <li className="album-row">
      <span className="album-cover">
        <RecordCover record={album} />
      </span>
      <div className="album-info">
        <span className="album-title">{album.title}</span>
        <span className="muted">{album.artist}</span>
        <span>{formatStreams(album.playCount)}</span>
        {album.otherEdition && (
          <span>
            On your shelf:{' '}
            <Link to={`/records/${album.otherEdition.recordId}`}>{album.otherEdition.title}</Link>
          </span>
        )}
        <PriceTag artist={album.artist} title={album.title} auto={autoPrice} />
        {addToWishlist.isError && (
          <span className="field-error" role="alert">
            Couldn't add it: {describeError(addToWishlist.error)}
          </span>
        )}
      </div>
      <div className="album-actions">
        {onWishlist ? (
          <span className="on-wishlist">✓ On your wishlist</span>
        ) : (
          <button
            type="button"
            className="button button-primary"
            disabled={addToWishlist.isPending}
            onClick={() =>
              addToWishlist.mutate({
                title: album.title,
                artist: album.artist,
                coverImageUrl: album.coverImageUrl,
                playCount: album.playCount,
              })
            }
          >
            {addToWishlist.isPending ? 'Adding…' : '+ Wishlist'}
          </button>
        )}
        <Link to={findOnDiscogsUrl(album)} className="button">
          Find on Discogs
        </Link>
      </div>
    </li>
  );
}
