// ============================================================================
// CollectionPage.tsx: YOUR RECORD COLLECTION (the home screen)
//
// A grid of every record, with a search box and a "sort by" menu.
// The search and sort live in the address bar (e.g. /?q=miles&sort=year), so
// the back button and bookmarks remember them.
// ============================================================================

import { Link, useSearchParams } from 'react-router';
import { RECORD_SORTS, type RecordListQuery } from '@vinyl/shared';
import { describeError } from '../api/client';
import { useRecords } from '../api/records';
import { RecordCard } from '../features/collection/RecordCard';
import { useDebouncedValue } from '../features/collection/useDebouncedValue';

type Sort = NonNullable<RecordListQuery['sort']>;

const SORT_LABELS: Record<Sort, string> = {
  added: 'Recently added',
  artist: 'Artist',
  title: 'Title',
  year: 'Year',
};

function isSort(value: string | null): value is Sort {
  return RECORD_SORTS.some((sort) => sort === value);
}

export function CollectionPage() {
  // Read ?q= and ?sort= from the address bar.
  const [searchParams, setSearchParams] = useSearchParams();
  const searchText = searchParams.get('q') ?? '';
  const sortParam = searchParams.get('sort');
  const sort: Sort = isSort(sortParam) ? sortParam : 'added';

  const q = useDebouncedValue(searchText.trim(), 250);
  const records = useRecords({ q: q || undefined, sort });

  /** Change one value in the address bar, removing it when it's the default. */
  function updateParam(name: 'q' | 'sort', value: string, defaultValue = '') {
    const next = new URLSearchParams(searchParams);
    if (value === defaultValue) next.delete(name);
    else next.set(name, value);
    // replace: true -> typing doesn't add a "back" step for every letter.
    setSearchParams(next, { replace: true });
  }

  return (
    <section>
      <div className="page-header">
        <h1>
          Your collection
          {records.data && !q && <span className="count">{records.data.length}</span>}
        </h1>
        <div className="actions-inline">
          <Link to="/discogs" className="button button-primary">
            + Add from Discogs
          </Link>
          <Link to="/records/new" className="button">
            Add manually
          </Link>
        </div>
      </div>

      <div className="toolbar">
        <label className="search">
          <span className="visually-hidden">Search records</span>
          <input
            type="search"
            placeholder="Search by title or artist"
            value={searchText}
            onChange={(event) => updateParam('q', event.target.value)}
          />
        </label>
        <label className="sort">
          Sort by
          <select
            value={sort}
            onChange={(event) => updateParam('sort', event.target.value, 'added')}
          >
            {RECORD_SORTS.map((value) => (
              <option key={value} value={value}>
                {SORT_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {records.isPending ? (
        <p className="muted">Loading your records…</p>
      ) : records.isError ? (
        <div className="error-box" role="alert">
          <p>Couldn't load your records: {describeError(records.error)}</p>
          <button type="button" className="button" onClick={() => records.refetch()}>
            Try again
          </button>
        </div>
      ) : records.data.length === 0 ? (
        q ? (
          <p className="muted">No records match “{q}”.</p>
        ) : (
          <div className="empty-state">
            <h2>Your shelf is empty</h2>
            <p>Add your first record to start tracking what you play.</p>
            <div className="actions-inline">
              <Link to="/discogs" className="button button-primary">
                + Add from Discogs
              </Link>
              <Link to="/records/new" className="button">
                Add manually
              </Link>
            </div>
          </div>
        )
      ) : (
        // `.map` turns each record into a card. React needs a unique `key` for each item.
        <ul className="record-grid">
          {records.data.map((record) => (
            <li key={record.id}>
              <RecordCard record={record} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
