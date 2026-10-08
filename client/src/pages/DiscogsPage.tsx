// ============================================================================
// DiscogsPage.tsx: SEARCH DISCOGS (/discogs)
//
// Two jobs, one page:
//   /discogs                    "Add from Discogs": search, then click
//                               "Add to collection" on the right pressing
//   /discogs?link=5&q=...       "Find on Discogs" for record 5 (opened from the
//                               record's page): "Use this release" fills in its
//                               cover and missing details, then goes back
//
// The search only runs when you press Search (not on every letter), because
// Discogs only allows 60 requests a minute.
// ============================================================================

import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import type { DiscogsSearchResult } from '@vinyl/shared';
import { describeError } from '../api/client';
import { useDiscogsSearch, useImportRelease, useLinkRecord } from '../api/discogs';
import { useRecord } from '../api/records';
import { DiscogsResult } from '../features/discogs/DiscogsResult';

export function DiscogsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get('q') ?? '';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const linkId = Number(searchParams.get('link')) || null;

  const search = useDiscogsSearch(q, page);

  function goTo(nextQ: string, nextPage: number) {
    const next = new URLSearchParams();
    if (linkId) next.set('link', String(linkId));
    next.set('q', nextQ);
    if (nextPage > 1) next.set('page', String(nextPage));
    setSearchParams(next);
  }

  return (
    <section>
      <Link to={linkId ? `/records/${linkId}` : '/'} className="back-link">
        ← {linkId ? 'Back to the record' : 'Collection'}
      </Link>
      <h1>{linkId ? 'Find on Discogs' : 'Add from Discogs'}</h1>
      {linkId ? (
        <LinkBanner recordId={linkId} />
      ) : (
        <p className="muted">Search for the pressing you own, then add it with one click.</p>
      )}

      {/* key={q}: a new search (or the back button) starts the box fresh with that search. */}
      <SearchForm key={q} initialText={q} onSearch={(text) => goTo(text, 1)} />

      {q === '' ? null : search.isPending ? (
        <p className="muted">Searching Discogs…</p>
      ) : search.isError ? (
        <div className="error-box" role="alert">
          <p>{describeError(search.error)}</p>
        </div>
      ) : search.data.results.length === 0 ? (
        <p className="muted">No vinyl releases found for “{q}”.</p>
      ) : (
        <>
          <Results results={search.data.results} linkId={linkId} />
          <div className="pager">
            <button
              type="button"
              className="button"
              disabled={page <= 1}
              onClick={() => goTo(q, page - 1)}
            >
              ← Previous
            </button>
            <span className="muted">
              Page {search.data.page} of {search.data.pages}
            </span>
            <button
              type="button"
              className="button"
              disabled={page >= search.data.pages}
              onClick={() => goTo(q, page + 1)}
            >
              Next →
            </button>
          </div>
        </>
      )}
    </section>
  );
}

/** The search box. Only searches when you press Search or Enter. */
function SearchForm({
  initialText,
  onSearch,
}: {
  initialText: string;
  onSearch: (text: string) => void;
}) {
  // What's typed in the box so far.
  const [text, setText] = useState(initialText);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (text.trim()) onSearch(text.trim());
  }

  return (
    <form className="toolbar" onSubmit={handleSubmit} role="search">
      <label className="search">
        <span className="visually-hidden">Search Discogs</span>
        <input
          type="search"
          placeholder="Artist, title, or catalog number"
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
      </label>
      <button type="submit" className="button button-primary">
        Search
      </button>
    </form>
  );
}

/** In link mode: says which record we're finding a release for. */
function LinkBanner({ recordId }: { recordId: number }) {
  const record = useRecord(recordId);
  return (
    <p className="banner">
      Choose the release that matches{' '}
      <strong>{record.data ? `“${record.data.title}”` : 'your record'}</strong>. Its cover and any
      empty details will be filled in. Nothing you typed will be changed.
    </p>
  );
}

function Results({ results, linkId }: { results: DiscogsSearchResult[]; linkId: number | null }) {
  const importRelease = useImportRelease();
  const linkRecord = useLinkRecord();
  const navigate = useNavigate();
  // Which release is being saved right now (to show "Adding…" on the right button).
  const busyId = importRelease.isPending
    ? importRelease.variables
    : linkRecord.isPending
      ? linkRecord.variables.releaseId
      : null;
  const error = importRelease.error ?? linkRecord.error;

  function action(result: DiscogsSearchResult) {
    if (result.inCollectionId !== null && result.inCollectionId !== linkId) {
      return (
        <Link to={`/records/${result.inCollectionId}`} className="button">
          In your collection →
        </Link>
      );
    }
    if (linkId) {
      return (
        <button
          type="button"
          className="button button-primary"
          disabled={busyId !== null}
          onClick={() =>
            linkRecord.mutate(
              { recordId: linkId, releaseId: result.releaseId },
              { onSuccess: () => navigate(`/records/${linkId}`) },
            )
          }
        >
          {busyId === result.releaseId ? 'Saving…' : 'Use this release'}
        </button>
      );
    }
    return (
      <button
        type="button"
        className="button button-primary"
        disabled={busyId !== null}
        onClick={() => importRelease.mutate(result.releaseId)}
      >
        {busyId === result.releaseId ? 'Adding…' : 'Add to collection'}
      </button>
    );
  }

  return (
    <>
      {error && (
        <div className="error-box" role="alert">
          <p>{describeError(error)}</p>
        </div>
      )}
      {importRelease.isSuccess && (
        <p className="success-box" role="status">
          Added “{importRelease.data.title}” to your collection.{' '}
          <Link to={`/records/${importRelease.data.id}`}>Open it</Link>
        </p>
      )}
      <ul className="discogs-results">
        {results.map((result) => (
          <DiscogsResult key={result.releaseId} result={result} action={action(result)} />
        ))}
      </ul>
    </>
  );
}
