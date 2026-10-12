// ============================================================================
// DiscoverPage.tsx: RECOMMENDATIONS (/discover)
//
// Albums you don't own by artists similar to the ones on your shelf, each
// with the reason ("Because you own Miles Davis and John Coltrane"), its
// vinyl price, and a button to add it to the wishlist.
// ============================================================================

import { Link } from 'react-router';
import type { Recommendation } from '@vinyl/shared';
import { ApiRequestError, describeError } from '../api/client';
import { useRecommendations } from '../api/recommendations';
import { useAddToWishlist } from '../api/streaming';
import { RecordCover } from '../features/collection/RecordCover';
import { findOnDiscogsUrl, formatList } from '../features/streaming/format';
import { PriceTag } from '../features/streaming/PriceTag';

/** How many albums look their price up by themselves (the rest have a button). */
const AUTO_PRICES = 5;

export function DiscoverPage() {
  const result = useRecommendations();

  return (
    <section>
      <div className="page-header">
        <h1>Discover</h1>
        <Link to="/wishlist" className="button">
          Wishlist
        </Link>
      </div>

      {result.isPending ? (
        <p className="muted">Looking for artists like the ones on your shelf…</p>
      ) : result.isError ? (
        <DiscoverError error={result.error} />
      ) : result.data.basedOn.length === 0 ? (
        <div className="empty-state">
          <h2>Nothing to go on yet</h2>
          <p>Recommendations are based on the records you own. Add a few first.</p>
          <Link to="/discogs" className="button button-primary">
            Add from Discogs
          </Link>
        </div>
      ) : (
        <div className="stats-body">
          {result.data.sample && (
            <p className="demo-inline" role="note">
              <strong>Sample data:</strong> this server isn't connected to Last.fm, so these come
              from a small built-in list. Prices are real, from Discogs.
            </p>
          )}
          <p className="streaming-summary">
            Albums you don't own, by artists similar to{' '}
            <strong>{formatList(result.data.basedOn)}</strong>.
          </p>
          {result.data.recommendations.length === 0 ? (
            <p className="muted">
              No suggestions this time: Last.fm doesn't know artists similar to these that you don't
              already own.
            </p>
          ) : (
            <ul className="album-list" aria-label="Recommendations">
              {result.data.recommendations.map((recommendation, index) => (
                <RecommendationRow
                  key={`${recommendation.artist}|${recommendation.title}`}
                  recommendation={recommendation}
                  autoPrice={index < AUTO_PRICES}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function DiscoverError({ error }: { error: Error }) {
  if (error instanceof ApiRequestError && error.code === 'LASTFM_NOT_CONFIGURED') {
    return (
      <div className="empty-state">
        <h2>Last.fm isn't set up on this server</h2>
        <p>
          Recommendations ask Last.fm which artists are alike. That needs a free Last.fm API key in
          the server's <code>.env</code> file (<code>LASTFM_API_KEY</code>). The README explains how
          to get one.
        </p>
      </div>
    );
  }
  return (
    <div className="error-box" role="alert">
      <p>Couldn't get recommendations: {describeError(error)}</p>
    </div>
  );
}

type RowProps = { recommendation: Recommendation; autoPrice: boolean };

function RecommendationRow({ recommendation, autoPrice }: RowProps) {
  // Each album has its own "add" state, so one button doesn't affect the others.
  const addToWishlist = useAddToWishlist();
  const { title, artist, coverImageUrl, because } = recommendation;
  const onWishlist = recommendation.wishlistItemId !== null || addToWishlist.isSuccess;

  return (
    <li className="album-row">
      <span className="album-cover">
        <RecordCover record={recommendation} />
      </span>
      <div className="album-info">
        <span className="album-title">{title}</span>
        <span className="muted">{artist}</span>
        <span>Because you own {formatList(because)}</span>
        <PriceTag artist={artist} title={title} auto={autoPrice} />
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
            onClick={() => addToWishlist.mutate({ title, artist, coverImageUrl })}
          >
            {addToWishlist.isPending ? 'Adding…' : '+ Wishlist'}
          </button>
        )}
        <Link to={findOnDiscogsUrl(recommendation)} className="button">
          Find on Discogs
        </Link>
      </div>
    </li>
  );
}
