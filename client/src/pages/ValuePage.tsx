// ============================================================================
// ValuePage.tsx: WHAT THE COLLECTION IS WORTH, OVER TIME (/value)
//
// The total value (from Discogs prices), how prices have moved, a chart over
// time, and the records from most to least valuable. The server looks prices
// up by itself about once a day; "Update prices now" does it straight away.
// Only records linked to a Discogs release can be priced.
// ============================================================================

import { Link } from 'react-router';
import type { CollectionValue, ValuedRecord } from '@vinyl/shared';
import { describeError } from '../api/client';
import { useCollectionValue, useRefreshPrices } from '../api/value';
import { formatArtists } from '../features/collection/format';
import { RecordCover } from '../features/collection/RecordCover';
import { formatPrice } from '../features/streaming/format';
import { formatChange, formatDay, formatPercent } from '../features/value/format';
import { ValueChart } from '../features/value/ValueChart';

export function ValuePage() {
  const value = useCollectionValue();
  const refresh = useRefreshPrices();
  const linkedCount = value.data
    ? value.data.totals.recordCount - value.data.totals.unlinkedCount
    : 0;

  return (
    <section>
      <div className="page-header">
        <h1>Collection value</h1>
        {/* Nothing to update for the demo's sample prices, or with no priceable records. */}
        {value.data && !value.data.sample && linkedCount > 0 && (
          <button
            type="button"
            className="button"
            disabled={refresh.isPending}
            onClick={() => refresh.mutate()}
          >
            {refresh.isPending ? 'Looking up prices…' : 'Update prices now'}
          </button>
        )}
      </div>

      {refresh.isSuccess && (
        <p className="save-note" role="status">
          {refreshMessage(refresh.data.updated, refresh.data.remaining)}
        </p>
      )}
      {refresh.isError && (
        <div className="error-box" role="alert">
          <p>Couldn't update prices: {describeError(refresh.error)}</p>
        </div>
      )}

      {value.isPending ? (
        <p className="muted">Adding up your collection…</p>
      ) : value.isError ? (
        <div className="error-box" role="alert">
          <p>Couldn't load the collection's value: {describeError(value.error)}</p>
        </div>
      ) : linkedCount === 0 ? (
        <div className="empty-state">
          <h2>Nothing to price yet</h2>
          <p>
            Prices come from Discogs, so a record needs to be linked to its Discogs release. Import
            records from Discogs, or open a record you added by hand and use “Find on Discogs”.
          </p>
          <Link to="/discogs" className="button button-primary">
            Add from Discogs
          </Link>
        </div>
      ) : value.data.records.length === 0 ? (
        <div className="empty-state">
          <h2>No prices yet</h2>
          <p>
            {linkedCount === 1 ? '1 record is' : `${linkedCount} records are`} waiting for a first
            price. The server looks prices up by itself within a few minutes, or use “Update prices
            now”.
          </p>
        </div>
      ) : (
        <ValueBody value={value.data} />
      )}
    </section>
  );
}

function refreshMessage(updated: number, remaining: number): string {
  if (updated === 0 && remaining === 0) return 'Prices are already up to date.';
  const done = `Updated ${updated} ${updated === 1 ? 'price' : 'prices'}.`;
  if (remaining === 0) return done;
  // Prices are looked up a few at a time, to go easy on Discogs.
  return `${done} ${remaining} more to go: click again in a minute.`;
}

function ValueBody({ value }: { value: CollectionValue }) {
  const { totals, movement, history, records, lastUpdatedAt } = value;
  // Every listed record has a snapshot, so there is always a currency by now.
  const currency = value.currency ?? 'USD';
  const top = records.find((r) => r.price !== null);

  const tiles = [
    { label: 'Collection value', value: formatPrice(totals.value, currency) },
    { label: 'Records priced', value: `${totals.pricedCount} of ${totals.recordCount}` },
    {
      label: movement ? `Prices since ${formatDay(movement.since, true)}` : 'Price movement',
      value: movement
        ? `${formatChange(movement.amount, currency)}${
            Math.abs(movement.amount) >= 0.005 ? ` (${formatPercent(movement.ratio)})` : ''
          }`
        : 'Not yet known',
    },
    {
      label: 'Most valuable',
      value: top && top.price !== null ? formatPrice(top.price, currency) : '–',
      note: top?.record.title,
    },
  ];

  return (
    <div className="stats-body">
      {value.sample && (
        <p className="demo-inline" role="note">
          <strong>Sample data:</strong> these prices and their history are made up for the demo.
          With your own account, they come from Discogs.
        </p>
      )}

      <dl className="stat-tiles">
        {tiles.map((tile) => (
          <div key={tile.label} className="stat-tile">
            <dt>{tile.label}</dt>
            <dd>{tile.value}</dd>
            {tile.note && <dd className="stat-tile-note">{tile.note}</dd>}
          </div>
        ))}
      </dl>

      {history.length > 1 ? (
        <ValueChart history={history} currency={currency} />
      ) : (
        <p className="muted">
          The chart appears once prices have been tracked for more than a day. They're looked up
          about once a day.
        </p>
      )}

      <section className="stats-card" aria-label="Records by value">
        <h2>Records by value</h2>
        <ol className="value-list">
          {records.map((valued) => (
            <ValueRow key={valued.record.id} valued={valued} currency={currency} />
          ))}
        </ol>
      </section>

      <p className="muted value-footnote">
        A record's value is the cheapest copy of that pressing for sale on Discogs.
        {totals.notForSaleCount > 0 &&
          ` ${totals.notForSaleCount} ${totals.notForSaleCount === 1 ? 'has' : 'have'} no copy for sale right now.`}
        {totals.pendingCount > 0 &&
          ` ${totals.pendingCount} ${totals.pendingCount === 1 ? 'is' : 'are'} waiting for a first price.`}
        {totals.unlinkedCount > 0 &&
          ` ${totals.unlinkedCount} ${totals.unlinkedCount === 1 ? "isn't" : "aren't"} linked to Discogs, so can't be priced (use “Find on Discogs” on the record's page).`}
        {lastUpdatedAt && ` Last updated ${new Date(lastUpdatedAt).toLocaleString()}.`}
      </p>
    </div>
  );
}

function ValueRow({ valued, currency }: { valued: ValuedRecord; currency: string }) {
  const { record, price, firstPrice } = valued;
  const moved = price !== null && firstPrice !== null && Math.abs(price - firstPrice) >= 0.005;

  return (
    <li>
      <span className="ranked-cover">
        <RecordCover record={record} />
      </span>
      <div className="ranked-main">
        <div className="ranked-label">
          <Link to={`/records/${record.id}`}>{record.title}</Link>
          <span className="muted"> · {formatArtists(record.artists)}</span>
        </div>
      </div>
      <span className="value-price">
        {price === null ? (
          <span className="muted">None for sale</span>
        ) : (
          <>
            <strong>{formatPrice(price, currency)}</strong>
            {moved && (
              <span className="muted"> · {formatChange(price - (firstPrice ?? 0), currency)}</span>
            )}
          </>
        )}
      </span>
    </li>
  );
}
