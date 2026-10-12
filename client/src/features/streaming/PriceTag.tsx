// ============================================================================
// PriceTag.tsx: WHAT AN ALBUM COSTS ON VINYL RIGHT NOW
//
// Asks our server, which asks Discogs for the cheapest copy for sale. The
// first few albums on a page look their price up by themselves; the rest show
// a "Check price" button, so a long list doesn't flood Discogs with requests.
// ============================================================================

import { useState } from 'react';
import { describeError } from '../../api/client';
import { useVinylPrice } from '../../api/streaming';
import { formatPrice } from './format';

type Props = {
  artist: string;
  title: string;
  /** Look the price up straight away, without waiting for a click. */
  auto: boolean;
};

export function PriceTag({ artist, title, auto }: Props) {
  const [asked, setAsked] = useState(false);
  const price = useVinylPrice({ artist, title }, auto || asked);

  if (!auto && !asked) {
    return (
      <button type="button" className="button button-small" onClick={() => setAsked(true)}>
        Check price
      </button>
    );
  }
  if (price.isPending) return <span className="muted">Checking the price…</span>;
  if (price.isError) {
    return <span className="muted">No price: {describeError(price.error)}</span>;
  }

  const { found, lowestPrice, currency, numForSale, releaseId } = price.data;
  if (!found) return <span className="muted">No vinyl pressing found on Discogs</span>;
  if (lowestPrice === null || currency === null) {
    return <span className="muted">None for sale on Discogs right now</span>;
  }
  return (
    <span className="price-tag">
      <strong>From {formatPrice(lowestPrice, currency)}</strong> on vinyl
      <span className="muted">
        {' · '}
        <a
          href={`https://www.discogs.com/sell/release/${releaseId}`}
          target="_blank"
          rel="noreferrer"
        >
          {numForSale} for sale on Discogs ↗
        </a>
      </span>
    </span>
  );
}
