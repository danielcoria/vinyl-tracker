// ============================================================================
// WishlistPage.tsx: ALBUMS TO BUY ONE DAY (/wishlist)
//
// Each album shows why it's here (how much it was streamed), what it costs on
// vinyl right now, a link to find it on Discogs, and a button to remove it.
// ============================================================================

import { Link } from 'react-router';
import type { WishlistItem } from '@vinyl/shared';
import { describeError } from '../api/client';
import { useRemoveFromWishlist, useWishlist } from '../api/streaming';
import { RecordCover } from '../features/collection/RecordCover';
import { findOnDiscogsUrl, formatStreams } from '../features/streaming/format';
import { PriceTag } from '../features/streaming/PriceTag';

/** How many albums look their price up by themselves (the rest have a button). */
const AUTO_PRICES = 8;

export function WishlistPage() {
  const wishlist = useWishlist();
  const remove = useRemoveFromWishlist();

  return (
    <section>
      <div className="page-header">
        <h1>
          Wishlist
          {wishlist.data && <span className="count">{wishlist.data.length}</span>}
        </h1>
        <Link to="/streaming" className="button">
          Streaming vs. shelf
        </Link>
      </div>

      {remove.isError && (
        <div className="error-box" role="alert">
          <p>Couldn't remove it: {describeError(remove.error)}</p>
        </div>
      )}

      {wishlist.isPending ? (
        <p className="muted">Loading your wishlist…</p>
      ) : wishlist.isError ? (
        <div className="error-box" role="alert">
          <p>Couldn't load your wishlist: {describeError(wishlist.error)}</p>
        </div>
      ) : wishlist.data.length === 0 ? (
        <div className="empty-state">
          <h2>Your wishlist is empty</h2>
          <p>Find albums you stream a lot but don't own yet, and add them here.</p>
          <Link to="/streaming" className="button button-primary">
            Compare streaming vs. shelf
          </Link>
        </div>
      ) : (
        <ul className="album-list" aria-label="Wishlist">
          {wishlist.data.map((item, index) => (
            <WishlistRow
              key={item.id}
              item={item}
              autoPrice={index < AUTO_PRICES}
              removing={remove.isPending && remove.variables === item.id}
              onRemove={() => remove.mutate(item.id)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

type RowProps = {
  item: WishlistItem;
  autoPrice: boolean;
  removing: boolean;
  onRemove: () => void;
};

function WishlistRow({ item, autoPrice, removing, onRemove }: RowProps) {
  return (
    <li className="album-row">
      <span className="album-cover">
        <RecordCover record={item} />
      </span>
      <div className="album-info">
        <span className="album-title">{item.title}</span>
        <span className="muted">{item.artist}</span>
        {item.playCount !== null && <span>{formatStreams(item.playCount)} when added</span>}
        <PriceTag artist={item.artist} title={item.title} auto={autoPrice} />
      </div>
      <div className="album-actions">
        <Link to={findOnDiscogsUrl(item)} className="button button-primary">
          Find on Discogs
        </Link>
        <button
          type="button"
          className="button"
          disabled={removing}
          aria-label={`Remove ${item.title} from the wishlist`}
          onClick={onRemove}
        >
          {removing ? 'Removing…' : 'Remove'}
        </button>
      </div>
    </li>
  );
}
